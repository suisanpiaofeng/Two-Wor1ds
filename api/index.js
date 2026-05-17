import express from "express";
import cors from "cors";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { ensureSchema, query } from "./utils/db.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use(async (req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (error) {
    console.error("Schema ensure error:", error);
    res.status(500).json({ error: "Database schema initialization failed" });
  }
});

app.get("/", (req, res) => {
  res.json({ message: "TwoWor1ds API Server", status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

const VERIFICATION_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;
const MAX_AVATAR_DATA_URL_LENGTH = 280000;
const MAX_AVATAR_SEED_LENGTH = 200;

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeAvatarValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:image/")) {
    const validDataUrl = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed);
    if (!validDataUrl) {
      throw new Error("Invalid avatar image format");
    }
    if (trimmed.length > MAX_AVATAR_DATA_URL_LENGTH) {
      throw new Error("Avatar image is too large");
    }
    return trimmed;
  }

  if (trimmed.length > MAX_AVATAR_SEED_LENGTH) {
    throw new Error("Avatar seed is too long");
  }

  return trimmed;
}

function hashVerificationCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function isVerificationCodeMatch(code, codeHash) {
  const submittedCodeHash = hashVerificationCode(code);
  return crypto.timingSafeEqual(
    Buffer.from(submittedCodeHash, "utf8"),
    Buffer.from(codeHash, "utf8")
  );
}

async function saveVerificationCode(email, code) {
  const codeHash = hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  await query(
    `INSERT INTO email_verification_codes (email, code_hash, attempts, expires_at, created_at, updated_at)
     VALUES ($1, $2, 0, $3, NOW(), NOW())
     ON CONFLICT (email)
     DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       attempts = 0,
       expires_at = EXCLUDED.expires_at,
       created_at = NOW(),
       updated_at = NOW()`,
    [email, codeHash, expiresAt]
  );
}

async function getVerificationCode(email) {
  const result = await query(
    "SELECT email, code_hash, attempts, expires_at FROM email_verification_codes WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
}

async function deleteVerificationCode(email) {
  await query("DELETE FROM email_verification_codes WHERE email = $1", [email]);
}

async function incrementVerificationAttempts(email) {
  const result = await query(
    `UPDATE email_verification_codes
     SET attempts = attempts + 1, updated_at = NOW()
     WHERE email = $1
     RETURNING attempts`,
    [email]
  );
  return result.rows[0] || null;
}

async function cleanupExpiredVerificationCodes() {
  await query(
    "DELETE FROM email_verification_codes WHERE expires_at < NOW() - INTERVAL '1 day'"
  );
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

async function sendVerificationEmail(email, code) {
  await saveVerificationCode(email, code);

  const transporter = createTransporter();

  if (!transporter) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return true;
  }

  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

  const mailOptions = {
    from: `"TwoWor1ds" <${fromEmail}>`,
    to: email,
    subject: "TwoWor1ds 邮箱验证码",
    text: `您的验证码是：${code}，5分钟内有效。`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #6366f1;">TwoWor1ds</h2>
        <p>您好，</p>
        <p>您的验证码是：</p>
        <div style="font-size: 32px; font-weight: bold; color: #6366f1; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666;">验证码有效期为5分钟，请尽快完成验证。</p>
        <p style="color: #999; font-size: 12px;">如果您没有请求此验证码，请忽略此邮件。</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification code sent to ${email}`);
    return true;
  } catch (error) {
    await deleteVerificationCode(email);
    console.error("SMTP error:", error.message);
    throw error;
  }
}

async function getUserFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const tokens = await query(
    "SELECT user_id FROM auth_tokens WHERE token = $1",
    [token]
  );
  if (tokens.rows.length === 0) return null;
  const users = await query(
    "SELECT id, email, nickname, avatar_seed FROM users WHERE id = $1",
    [tokens.rows[0].user_id]
  );
  return users.rows.length > 0 ? users.rows[0] : null;
}

async function createNotification({
  recipientUserId,
  actorUserId,
  postId,
  type,
  commentId = null,
  commentContent = null,
  targetCommentContent = null
}) {
  if (!recipientUserId || !actorUserId || recipientUserId === actorUserId) {
    return;
  }

  await query(
    `INSERT INTO notifications (
       id, user_id, actor_user_id, post_id, type, comment_id, comment_content, target_comment_content, created_at, read
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), false)`,
    [
      uuidv4(),
      recipientUserId,
      actorUserId,
      postId,
      type,
      commentId,
      commentContent,
      targetCommentContent
    ]
  );
}

function mapConversationRow(conversation, currentUserId) {
  return {
    id: conversation.id,
    other_user: {
      id: conversation.other_user_id,
      nickname: conversation.other_user_nickname,
      avatarSeed: conversation.other_user_avatar_seed
    },
    last_message: conversation.last_message_id ? {
      id: conversation.last_message_id,
      conversation_id: conversation.id,
      sender_id: conversation.last_message_sender_id,
      content: conversation.last_message_content,
      created_at: new Date(conversation.last_message_created_at).getTime()
    } : null,
    unread_count: parseInt(conversation.unread_count ?? "0", 10),
    updated_at: new Date(
      conversation.last_message_at || conversation.updated_at || conversation.created_at
    ).getTime(),
    current_user_id: currentUserId
  };
}

async function getConversationListPayload(userId, conversationId = null) {
  const params = [userId];
  const conversationClause = conversationId ? "AND c.id = $2" : "";
  if (conversationId) {
    params.push(conversationId);
  }

  const result = await query(
    `SELECT c.id, c.created_at, c.updated_at, c.last_message_at,
            ou.id as other_user_id, ou.nickname as other_user_nickname, ou.avatar_seed as other_user_avatar_seed,
            lm.id as last_message_id, lm.sender_id as last_message_sender_id,
            lm.content as last_message_content, lm.created_at as last_message_created_at,
            CASE
              WHEN c.user_one_id = $1 THEN (
                SELECT COUNT(*)
                FROM conversation_messages cm
                WHERE cm.conversation_id = c.id
                  AND cm.sender_id <> $1
                  AND cm.created_at > COALESCE(c.user_one_last_read_at, TIMESTAMP 'epoch')
              )
              ELSE (
                SELECT COUNT(*)
                FROM conversation_messages cm
                WHERE cm.conversation_id = c.id
                  AND cm.sender_id <> $1
                  AND cm.created_at > COALESCE(c.user_two_last_read_at, TIMESTAMP 'epoch')
              )
            END as unread_count
     FROM conversations c
     JOIN users ou
       ON ou.id = CASE
         WHEN c.user_one_id = $1 THEN c.user_two_id
         ELSE c.user_one_id
       END
     LEFT JOIN LATERAL (
       SELECT m.id, m.sender_id, m.content, m.created_at
       FROM conversation_messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC
       LIMIT 1
     ) lm ON true
     WHERE (c.user_one_id = $1 OR c.user_two_id = $1)
       ${conversationClause}
     ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC`,
    params
  );

  return result.rows.map(row => mapConversationRow(row, userId));
}

async function getConversationByIdForUser(conversationId, userId) {
  const conversations = await getConversationListPayload(userId, conversationId);
  return conversations[0] || null;
}

async function getConversationRecordForUser(conversationId, userId) {
  const result = await query(
    `SELECT id, user_one_id, user_two_id
     FROM conversations
     WHERE id = $1
       AND (user_one_id = $2 OR user_two_id = $2)
     LIMIT 1`,
    [conversationId, userId]
  );

  return result.rows[0] || null;
}

async function buildCommentInteractionSets(commentIds, userId = null) {
  let likedCommentIds = new Set();
  let collectedCommentIds = new Set();

  if (!userId || commentIds.length === 0) {
    return { likedCommentIds, collectedCommentIds };
  }

  const [commentLikes, commentCollections] = await Promise.all([
    query(
      "SELECT comment_id FROM comment_likes WHERE user_id = $1 AND comment_id = ANY($2)",
      [userId, commentIds]
    ),
    query(
      "SELECT comment_id FROM comment_collections WHERE user_id = $1 AND comment_id = ANY($2)",
      [userId, commentIds]
    )
  ]);

  likedCommentIds = new Set(commentLikes.rows.map(row => row.comment_id));
  collectedCommentIds = new Set(commentCollections.rows.map(row => row.comment_id));

  return { likedCommentIds, collectedCommentIds };
}

function mapCommentRow(comment, likedCommentIds, collectedCommentIds) {
  return {
    id: comment.id,
    post_id: comment.post_id,
    content: comment.content,
    user_id: comment.user_id,
    nickname: comment.nickname,
    avatar_seed: comment.avatar_seed,
    likes_count: comment.likes_count ?? 0,
    collections_count: comment.collections_count ?? 0,
    current_user_liked: likedCommentIds.has(comment.id),
    current_user_collected: collectedCommentIds.has(comment.id),
    created_at: new Date(comment.created_at).getTime(),
    root_comment_id: comment.root_comment_id,
    reply_to_comment_id: comment.reply_to_comment_id,
    reply_to_nickname: comment.reply_to_nickname ?? null,
    replies: []
  };
}

async function buildCommentsMap(postIds, userId = null) {
  const commentsMap = {};
  if (postIds.length === 0) {
    return commentsMap;
  }

  const comments = await query(
    `SELECT c.id, c.post_id, c.content, c.created_at, c.likes_count, c.collections_count,
            c.root_comment_id, c.reply_to_comment_id,
            u.id as user_id, u.nickname, u.avatar_seed
     FROM comments c JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ANY($1)
     ORDER BY COALESCE(c.root_comment_id, c.id), c.created_at ASC`,
    [postIds]
  );

  const commentIds = comments.rows.map(comment => comment.id);
  const { likedCommentIds, collectedCommentIds } = await buildCommentInteractionSets(commentIds, userId);

  const commentMap = new Map();
  const orderedComments = comments.rows.map(comment => {
    const mappedComment = mapCommentRow(comment, likedCommentIds, collectedCommentIds);
    commentMap.set(mappedComment.id, mappedComment);
    return mappedComment;
  });

  for (const comment of orderedComments) {
    if (comment.reply_to_comment_id) {
      comment.reply_to_nickname = commentMap.get(comment.reply_to_comment_id)?.nickname || null;
    }
  }

  for (const comment of orderedComments) {
    if (!commentsMap[comment.post_id]) {
      commentsMap[comment.post_id] = [];
    }

    if (comment.root_comment_id) {
      const rootComment = commentMap.get(comment.root_comment_id);
      if (rootComment) {
        rootComment.replies.push(comment);
        continue;
      }
    }

    commentsMap[comment.post_id].push(comment);
  }

  return commentsMap;
}

async function getPostInteractionSets(postIds, userId = null) {
  let likedPostIds = new Set();
  let collectedPostIds = new Set();

  if (!userId || postIds.length === 0) {
    return { likedPostIds, collectedPostIds };
  }

  const [likes, collections] = await Promise.all([
    query(
      "SELECT post_id FROM likes WHERE user_id = $1 AND post_id = ANY($2)",
      [userId, postIds]
    ),
    query(
      "SELECT post_id FROM collections WHERE user_id = $1 AND post_id = ANY($2)",
      [userId, postIds]
    )
  ]);

  likedPostIds = new Set(likes.rows.map(row => row.post_id));
  collectedPostIds = new Set(collections.rows.map(row => row.post_id));

  return { likedPostIds, collectedPostIds };
}

function mapPostRow(post, commentsMap, likedPostIds, collectedPostIds) {
  return {
    id: post.id,
    content: post.content,
    tags: post.tags,
    likes_count: post.likes_count,
    collections_count: post.collections_count ?? 0,
    comments_count: post.comments_count,
    user_id: post.user_id,
    nickname: post.nickname,
    avatar_seed: post.avatar_seed,
    created_at: new Date(post.created_at).getTime(),
    comments: commentsMap[post.id] || [],
    current_user_liked: likedPostIds.has(post.id),
    current_user_collected: collectedPostIds.has(post.id)
  };
}

async function getPostDetailPayload(postId, userId = null) {
  const postResult = await query(
    `SELECT p.id, p.content, p.tags, p.likes_count, p.collections_count, p.comments_count, p.created_at,
            u.id as user_id, u.nickname, u.avatar_seed
     FROM posts p JOIN users u ON p.user_id = u.id
     WHERE p.id = $1
     LIMIT 1`,
    [postId]
  );

  if (postResult.rows.length === 0) {
    return null;
  }

  const [commentsMap, { likedPostIds, collectedPostIds }] = await Promise.all([
    buildCommentsMap([postId], userId),
    getPostInteractionSets([postId], userId)
  ]);

  return mapPostRow(postResult.rows[0], commentsMap, likedPostIds, collectedPostIds);
}

app.post("/api/auth/send-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const normalizedEmail = normalizeEmail(email);
    await cleanupExpiredVerificationCodes();

    const code = generateCode();
    await sendVerificationEmail(normalizedEmail, code);

    res.json({ success: true, message: "验证码已发送" });
  } catch (error) {
    console.error("Send code error:", error);
    res.status(500).json({ error: "Failed to send code" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, code, password, nickname } = req.body;
    
    if (!email || !code || !password || !nickname) {
      return res.status(400).json({ error: "请填写完整信息" });
    }

    const normalizedEmail = normalizeEmail(email);
    const verificationCode = await getVerificationCode(normalizedEmail);

    if (!verificationCode) {
      return res.status(400).json({ error: "请先发送验证码" });
    }

    if (new Date(verificationCode.expires_at).getTime() < Date.now()) {
      await deleteVerificationCode(normalizedEmail);
      return res.status(400).json({ error: "验证码已过期" });
    }

    if (verificationCode.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await deleteVerificationCode(normalizedEmail);
      return res.status(429).json({ error: "验证码尝试次数过多，请重新发送" });
    }

    if (!isVerificationCodeMatch(code, verificationCode.code_hash)) {
      const updatedRecord = await incrementVerificationAttempts(normalizedEmail);
      const attempts = updatedRecord?.attempts ?? verificationCode.attempts + 1;

      if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
        await deleteVerificationCode(normalizedEmail);
        return res.status(429).json({ error: "验证码尝试次数过多，请重新发送" });
      }

      return res.status(400).json({ error: "验证码错误" });
    }

    const existingUsers = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existingUsers.rows.length > 0) {
      return res.status(400).json({ error: "该邮箱已注册" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const avatarSeed = uuidv4();

    await query(
      "INSERT INTO users (id, email, password_hash, nickname, avatar_seed, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [userId, normalizedEmail, passwordHash, nickname, avatarSeed]
    );

    const token = crypto.randomBytes(32).toString("hex");
    await query("INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, userId]);

    await deleteVerificationCode(normalizedEmail);

    res.status(201).json({
      success: true,
      user: { id: userId, email: normalizedEmail, nickname, avatarSeed },
      token
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "请填写邮箱和密码" });
    }

    const normalizedEmail = normalizeEmail(email);
    const users = await query("SELECT id, password_hash, nickname, avatar_seed FROM users WHERE email = $1", [normalizedEmail]);
    if (users.rows.length === 0) {
      return res.status(401).json({ error: "邮箱或密码错误" });
    }

    const user = users.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "邮箱或密码错误" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await query("INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, user.id]);

    res.json({
      success: true,
      user: { id: user.id, email: normalizedEmail, nickname: user.nickname, avatarSeed: user.avatar_seed },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/verify", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    res.json({
      valid: true,
      user: { id: user.id, email: user.email, nickname: user.nickname, avatarSeed: user.avatar_seed }
    });
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      await query("DELETE FROM auth_tokens WHERE token = $1", [token]);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.post("/api/auth/quickstart", async (req, res) => {
  try {
    const { deviceId } = req.body;
    const avatarSeed = uuidv4();
    const guestNicknames = [
      '月光漫步者', '星河旅人', '晨雾行者', '清风明月', '静夜思语',
      '云端游侠', '竹影诗者', '枫叶飘零', '雪花飞舞', '春风十里',
      '夏雨微凉', '秋叶静美', '冬雪初霁', '山水之间', '诗与远方'
    ];
    const displayName = guestNicknames[Math.floor(Math.random() * guestNicknames.length)];

    if (deviceId) {
      const existingTokens = await query(
        "SELECT t.user_id, u.email, u.nickname, u.avatar_seed FROM auth_tokens t JOIN users u ON t.user_id = u.id WHERE t.token = $1",
        [deviceId]
      );
      if (existingTokens.rows.length > 0) {
        const user = existingTokens.rows[0];
        const token = crypto.randomBytes(32).toString("hex");
        await query("INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, user.user_id]);
        return res.json({
          success: true,
          user: { id: user.user_id, email: user.email, nickname: user.nickname, avatarSeed: user.avatar_seed },
          token
        });
      }
    }

    const userId = uuidv4();
    const guestEmail = `guest_${Date.now()}@two-wor1ds.local`;

    await query(
      "INSERT INTO users (id, email, password_hash, nickname, avatar_seed, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [userId, guestEmail, '', displayName, avatarSeed]
    );

    const token = crypto.randomBytes(32).toString("hex");
    await query("INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, userId]);

    res.status(201).json({
      success: true,
      user: { id: userId, email: guestEmail, nickname: displayName, avatarSeed },
      token
    });
  } catch (error) {
    console.error("Quickstart error:", error);
    res.status(500).json({ error: "Quick start failed" });
  }
});

app.put("/api/users/profile", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { nickname, avatar_seed } = req.body;
    const normalizedAvatarSeed = normalizeAvatarValue(avatar_seed);
    
    if (nickname) {
      await query("UPDATE users SET nickname = $1 WHERE id = $2", [nickname, user.id]);
    }
    if (avatar_seed !== undefined) {
      await query("UPDATE users SET avatar_seed = $1 WHERE id = $2", [normalizedAvatarSeed, user.id]);
    }

    const updatedUser = await query("SELECT id, email, nickname, avatar_seed FROM users WHERE id = $1", [user.id]);
    
    res.json({
      success: true,
      user: { 
        id: updatedUser.rows[0].id, 
        email: updatedUser.rows[0].email, 
        nickname: updatedUser.rows[0].nickname, 
        avatarSeed: updatedUser.rows[0].avatar_seed 
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error instanceof Error && (
      error.message === "Invalid avatar image format"
      || error.message === "Avatar image is too large"
      || error.message === "Avatar seed is too long"
    )) {
      return res.status(400).json({ error: "头像格式不正确或图片过大" });
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.get("/api/users/collections", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const collections = await query(
      `SELECT p.id, p.content, p.tags, p.likes_count, p.collections_count, p.comments_count, p.created_at,
              u.id as user_id, u.nickname, u.avatar_seed
       FROM collections c 
       JOIN posts p ON c.post_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [user.id]
    );

    const postIds = collections.rows.map(row => row.id);
    const { likedPostIds, collectedPostIds } = await getPostInteractionSets(postIds, user.id);

    const collectedComments = await query(
      `SELECT c.id, c.post_id, c.content, c.created_at, c.likes_count, c.collections_count,
              c.root_comment_id, c.reply_to_comment_id,
              cu.id as user_id, cu.nickname, cu.avatar_seed,
              ru.nickname as reply_to_nickname,
              p.content as post_content, p.created_at as post_created_at,
              pu.id as post_user_id, pu.nickname as post_user_nickname, pu.avatar_seed as post_user_avatar_seed
       FROM comment_collections cc
       JOIN comments c ON cc.comment_id = c.id
       JOIN users cu ON c.user_id = cu.id
       JOIN posts p ON c.post_id = p.id
       JOIN users pu ON p.user_id = pu.id
       LEFT JOIN comments rc ON c.reply_to_comment_id = rc.id
       LEFT JOIN users ru ON rc.user_id = ru.id
       WHERE cc.user_id = $1
       ORDER BY cc.created_at DESC`,
      [user.id]
    );

    const commentIds = collectedComments.rows.map(row => row.id);
    const { likedCommentIds, collectedCommentIds } = await buildCommentInteractionSets(commentIds, user.id);

    res.json({
      posts: collections.rows.map(post => mapPostRow(post, {}, likedPostIds, collectedPostIds)),
      comments: collectedComments.rows.map(comment => ({
        ...mapCommentRow(comment, likedCommentIds, collectedCommentIds),
        post_content: comment.post_content,
        post_created_at: new Date(comment.post_created_at).getTime(),
        post_user_id: comment.post_user_id,
        post_user_nickname: comment.post_user_nickname,
        post_user_avatar_seed: comment.post_user_avatar_seed
      }))
    });
  } catch (error) {
    console.error("Get collections error:", error);
    res.status(500).json({ error: "Failed to get collections" });
  }
});

app.get("/api/users/comments", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const comments = await query(
      `SELECT c.id, c.post_id, c.content, c.created_at, c.likes_count, c.collections_count,
              c.root_comment_id, c.reply_to_comment_id,
              cu.id as user_id, cu.nickname, cu.avatar_seed,
              ru.nickname as reply_to_nickname,
              p.content as post_content, p.created_at as post_created_at,
              pu.id as post_user_id, pu.nickname as post_user_nickname, pu.avatar_seed as post_user_avatar_seed
       FROM comments c
       JOIN users cu ON c.user_id = cu.id
       JOIN posts p ON c.post_id = p.id
       JOIN users pu ON p.user_id = pu.id
       LEFT JOIN comments rc ON c.reply_to_comment_id = rc.id
       LEFT JOIN users ru ON rc.user_id = ru.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [user.id]
    );

    const commentIds = comments.rows.map(row => row.id);
    const { likedCommentIds, collectedCommentIds } = await buildCommentInteractionSets(commentIds, user.id);

    res.json({
      comments: comments.rows.map(comment => ({
        ...mapCommentRow(comment, likedCommentIds, collectedCommentIds),
        post_content: comment.post_content,
        post_created_at: new Date(comment.post_created_at).getTime(),
        post_user_id: comment.post_user_id,
        post_user_nickname: comment.post_user_nickname,
        post_user_avatar_seed: comment.post_user_avatar_seed
      }))
    });
  } catch (error) {
    console.error("Get my comments error:", error);
    res.status(500).json({ error: "Failed to get my comments" });
  }
});

app.get("/api/users/:id/profile", async (req, res) => {
  try {
    const viewer = await getUserFromToken(req);
    if (!viewer) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const userResult = await query(
      "SELECT id, email, nickname, avatar_seed FROM users WHERE id = $1 LIMIT 1",
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const postsResult = await query(
      `SELECT p.id, p.content, p.tags, p.likes_count, p.collections_count, p.comments_count, p.created_at,
              u.id as user_id, u.nickname, u.avatar_seed
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [id]
    );

    const postIds = postsResult.rows.map(row => row.id);
    const [commentsMap, { likedPostIds, collectedPostIds }] = await Promise.all([
      buildCommentsMap(postIds, viewer.id),
      getPostInteractionSets(postIds, viewer.id)
    ]);

    res.json({
      user: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        nickname: userResult.rows[0].nickname,
        avatarSeed: userResult.rows[0].avatar_seed
      },
      posts: postsResult.rows.map(post => mapPostRow(post, commentsMap, likedPostIds, collectedPostIds))
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

app.post("/api/posts/:id/collect", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const existing = await query("SELECT id FROM collections WHERE post_id = $1 AND user_id = $2", [id, user.id]);

    if (existing.rows.length > 0) {
      await query("DELETE FROM collections WHERE post_id = $1 AND user_id = $2", [id, user.id]);
      const updatedPost = await query(
        "UPDATE posts SET collections_count = GREATEST(collections_count - 1, 0) WHERE id = $1 RETURNING collections_count",
        [id]
      );
      res.json({ collected: false, collections_count: updatedPost.rows[0]?.collections_count ?? 0 });
    } else {
      await query("INSERT INTO collections (post_id, user_id, created_at) VALUES ($1, $2, NOW())", [id, user.id]);
      const updatedPost = await query(
        "UPDATE posts SET collections_count = collections_count + 1 WHERE id = $1 RETURNING collections_count",
        [id]
      );

      const post = await query("SELECT user_id FROM posts WHERE id = $1 LIMIT 1", [id]);
      if (post.rows.length > 0) {
        await createNotification({
          recipientUserId: post.rows[0].user_id,
          actorUserId: user.id,
          postId: id,
          type: "collect"
        });
      }

      res.json({ collected: true, collections_count: updatedPost.rows[0]?.collections_count ?? 0 });
    }
  } catch (error) {
    console.error("Collect post error:", error);
    res.status(500).json({ error: "Failed to collect post" });
  }
});

app.get("/api/posts", async (req, res) => {
  try {
    const { tag, sort = "latest", limit = 50, offset = 0 } = req.query;
    const user = await getUserFromToken(req);
    let orderBy = "p.created_at DESC";
    if (sort === "popular") orderBy = "p.likes_count DESC, p.created_at DESC";

    let whereClause = "";
    const params = [];
    let paramIdx = 1;

    if (tag) {
      whereClause = `WHERE p.tags @> $${paramIdx}`;
      params.push(`{${tag}}`);
      paramIdx++;
    }

    const posts = await query(
      `SELECT p.id, p.content, p.tags, p.likes_count, p.collections_count, p.comments_count, p.created_at,
              u.id as user_id, u.nickname, u.avatar_seed
       FROM posts p JOIN users u ON p.user_id = u.id
       ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const postIds = posts.rows.map(p => p.id);
    const [commentsMap, { likedPostIds, collectedPostIds }] = await Promise.all([
      buildCommentsMap(postIds, user?.id),
      getPostInteractionSets(postIds, user?.id)
    ]);

    res.json({
      posts: posts.rows.map(post => mapPostRow(post, commentsMap, likedPostIds, collectedPostIds))
    });
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: "Failed to get posts" });
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    const { id } = req.params;

    const post = await getPostDetailPayload(id, user?.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({
      post
    });
  } catch (error) {
    console.error("Get post detail error:", error);
    res.status(500).json({ error: "Failed to get post detail" });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { content, tags } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: "Content is required" });
    if (content.length > 500) return res.status(400).json({ error: "Content too long" });

    const postId = uuidv4();
    const tagsArray = Array.isArray(tags) ? tags : [];

    await query(
      "INSERT INTO posts (id, user_id, content, tags, likes_count, collections_count, comments_count, created_at) VALUES ($1, $2, $3, $4, 0, 0, 0, NOW())",
      [postId, user.id, content.trim(), tagsArray]
    );

    res.status(201).json({
      success: true,
      post: {
        id: postId, content: content.trim(), tags: tagsArray, likes: 0, comments: [],
        user: { id: user.id, nickname: user.nickname, avatarSeed: user.avatar_seed },
        createdAt: Date.now()
      }
    });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.put("/api/posts/:id", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { content, tags } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Content is required" });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: "Content too long" });
    }

    const existingPost = await query("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (existingPost.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (existingPost.rows[0].user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await query(
      "UPDATE posts SET content = $1, tags = $2 WHERE id = $3",
      [content.trim(), Array.isArray(tags) ? tags : [], id]
    );

    const post = await getPostDetailPayload(id, user.id);
    res.json({ success: true, post });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({ error: "Failed to update post" });
  }
});

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const posts = await query("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (posts.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    if (posts.rows[0].user_id !== user.id) return res.status(403).json({ error: "Not authorized" });

    await query("DELETE FROM comments WHERE post_id = $1", [id]);
    await query("DELETE FROM likes WHERE post_id = $1", [id]);
    await query("DELETE FROM collections WHERE post_id = $1", [id]);
    await query("DELETE FROM notifications WHERE post_id = $1", [id]);
    await query("DELETE FROM posts WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

app.post("/api/posts/:id/like", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const existingLike = await query("SELECT id FROM likes WHERE post_id = $1 AND user_id = $2", [id, user.id]);

    if (existingLike.rows.length > 0) {
      await query("DELETE FROM likes WHERE post_id = $1 AND user_id = $2", [id, user.id]);
      const updatedPost = await query(
        "UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1 RETURNING likes_count",
        [id]
      );
      res.json({ liked: false, likes_count: updatedPost.rows[0]?.likes_count ?? 0 });
    } else {
      await query("INSERT INTO likes (post_id, user_id, created_at) VALUES ($1, $2, NOW())", [id, user.id]);
      const updatedPost = await query(
        "UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count",
        [id]
      );

      const post = await query("SELECT user_id FROM posts WHERE id = $1", [id]);
      if (post.rows.length > 0) {
        await createNotification({
          recipientUserId: post.rows[0].user_id,
          actorUserId: user.id,
          postId: id,
          type: "like"
        });
      }

      res.json({ liked: true, likes_count: updatedPost.rows[0]?.likes_count ?? 0 });
    }
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
});

app.post("/api/posts/:id/comment", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { content, parentCommentId } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: "Comment content is required" });

    let rootCommentId = null;
    let replyToCommentId = null;
    let replyToNickname = null;

    let parentCommentRow = null;

    if (parentCommentId) {
      const parentComment = await query(
        `SELECT c.id, c.post_id, c.root_comment_id, u.nickname
                , c.user_id, c.content
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1
         LIMIT 1`,
        [parentCommentId]
      );

      if (parentComment.rows.length === 0) {
        return res.status(404).json({ error: "Parent comment not found" });
      }

      if (parentComment.rows[0].post_id !== id) {
        return res.status(400).json({ error: "Parent comment does not belong to this post" });
      }

      parentCommentRow = parentComment.rows[0];
      rootCommentId = parentComment.rows[0].root_comment_id || parentComment.rows[0].id;
      replyToCommentId = parentComment.rows[0].id;
      replyToNickname = parentComment.rows[0].nickname;
    }

    const commentId = uuidv4();
    await query(
      `INSERT INTO comments (id, post_id, user_id, content, root_comment_id, reply_to_comment_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [commentId, id, user.id, content.trim(), rootCommentId, replyToCommentId]
    );
    await query("UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1", [id]);

    const post = await query("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (post.rows.length > 0) {
      const postOwnerId = post.rows[0].user_id;
      if (!parentCommentRow || postOwnerId !== parentCommentRow.user_id) {
        await createNotification({
          recipientUserId: postOwnerId,
          actorUserId: user.id,
          postId: id,
          type: "comment",
          commentId,
          commentContent: content.trim()
        });
      }
    }

    if (parentCommentRow) {
      await createNotification({
        recipientUserId: parentCommentRow.user_id,
        actorUserId: user.id,
        postId: id,
        type: "comment_reply",
        commentId,
        commentContent: content.trim(),
        targetCommentContent: parentCommentRow.content
      });
    }

    res.status(201).json({
      success: true,
      comment: {
        id: commentId,
        content: content.trim(),
        user_id: user.id,
        nickname: user.nickname,
        avatar_seed: user.avatar_seed,
        likes_count: 0,
        collections_count: 0,
        current_user_liked: false,
        current_user_collected: false,
        created_at: Date.now(),
        root_comment_id: rootCommentId,
        reply_to_comment_id: replyToCommentId,
        reply_to_nickname: replyToNickname,
        replies: []
      }
    });
  } catch (error) {
    console.error("Comment post error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const targetComment = await query(
      "SELECT id, post_id, user_id FROM comments WHERE id = $1 LIMIT 1",
      [id]
    );

    if (targetComment.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (targetComment.rows[0].user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const subtree = await query(
      `WITH RECURSIVE comment_tree AS (
         SELECT id FROM comments WHERE id = $1
         UNION ALL
         SELECT c.id
         FROM comments c
         JOIN comment_tree ct ON c.reply_to_comment_id = ct.id
       )
       SELECT id FROM comment_tree`,
      [id]
    );

    const deleteIds = subtree.rows.map(row => row.id);
    await query("DELETE FROM comments WHERE id = ANY($1)", [deleteIds]);
    await query(
      "UPDATE posts SET comments_count = GREATEST(comments_count - $1, 0) WHERE id = $2",
      [deleteIds.length, targetComment.rows[0].post_id]
    );

    res.json({
      success: true,
      post_id: targetComment.rows[0].post_id,
      deleted_count: deleteIds.length,
      deleted_ids: deleteIds
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

app.post("/api/comments/:id/like", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const existingLike = await query("SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2", [id, user.id]);

    if (existingLike.rows.length > 0) {
      await query("DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2", [id, user.id]);
      const updatedComment = await query(
        "UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1 RETURNING likes_count",
        [id]
      );
      return res.json({ liked: false, likes_count: updatedComment.rows[0]?.likes_count ?? 0 });
    }

    const targetComment = await query(
      "SELECT id, post_id, user_id, content FROM comments WHERE id = $1 LIMIT 1",
      [id]
    );
    if (targetComment.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    await query("INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES ($1, $2, NOW())", [id, user.id]);
    const updatedComment = await query(
      "UPDATE comments SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count",
      [id]
    );

    await createNotification({
      recipientUserId: targetComment.rows[0].user_id,
      actorUserId: user.id,
      postId: targetComment.rows[0].post_id,
      type: "comment_like",
      commentId: id,
      targetCommentContent: targetComment.rows[0].content
    });

    res.json({ liked: true, likes_count: updatedComment.rows[0]?.likes_count ?? 0 });
  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({ error: "Failed to like comment" });
  }
});

app.post("/api/comments/:id/collect", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const existingCollection = await query("SELECT id FROM comment_collections WHERE comment_id = $1 AND user_id = $2", [id, user.id]);

    if (existingCollection.rows.length > 0) {
      await query("DELETE FROM comment_collections WHERE comment_id = $1 AND user_id = $2", [id, user.id]);
      const updatedComment = await query(
        "UPDATE comments SET collections_count = GREATEST(collections_count - 1, 0) WHERE id = $1 RETURNING collections_count",
        [id]
      );
      return res.json({ collected: false, collections_count: updatedComment.rows[0]?.collections_count ?? 0 });
    }

    const targetComment = await query(
      "SELECT id, post_id, user_id, content FROM comments WHERE id = $1 LIMIT 1",
      [id]
    );
    if (targetComment.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    await query("INSERT INTO comment_collections (comment_id, user_id, created_at) VALUES ($1, $2, NOW())", [id, user.id]);
    const updatedComment = await query(
      "UPDATE comments SET collections_count = collections_count + 1 WHERE id = $1 RETURNING collections_count",
      [id]
    );

    await createNotification({
      recipientUserId: targetComment.rows[0].user_id,
      actorUserId: user.id,
      postId: targetComment.rows[0].post_id,
      type: "comment_collect",
      commentId: id,
      targetCommentContent: targetComment.rows[0].content
    });

    res.json({ collected: true, collections_count: updatedComment.rows[0]?.collections_count ?? 0 });
  } catch (error) {
    console.error("Collect comment error:", error);
    res.status(500).json({ error: "Failed to collect comment" });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const notifications = await query(
      `SELECT n.id, n.type, n.post_id, n.comment_id, n.comment_content, n.target_comment_content, n.created_at, n.read,
              p.content as post_content, p.tags,
              u.id as actor_id, u.nickname as actor_nickname, u.avatar_seed as actor_avatar_seed
       FROM notifications n
       LEFT JOIN posts p ON n.post_id = p.id
       LEFT JOIN users u ON n.actor_user_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [user.id]
    );

    res.json({
      notifications: notifications.rows.map(n => ({
        id: n.id,
        type: n.type,
        post_id: n.post_id,
        comment_id: n.comment_id,
        comment_content: n.comment_content,
        target_comment_content: n.target_comment_content,
        post_content: n.post_content,
        tags: n.tags,
        actor: {
          id: n.actor_id,
          nickname: n.actor_nickname,
          avatarSeed: n.actor_avatar_seed
        },
        created_at: new Date(n.created_at).getTime(),
        read: n.read
      }))
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

app.get("/api/conversations", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const conversations = await getConversationListPayload(user.id);
    res.json({ conversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

app.post("/api/conversations/direct", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { target_user_id: targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: "Target user is required" });
    }
    if (targetUserId === user.id) {
      return res.status(400).json({ error: "Cannot chat with yourself" });
    }

    const targetUser = await query("SELECT id FROM users WHERE id = $1 LIMIT 1", [targetUserId]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const [userOneId, userTwoId] = [user.id, targetUserId].sort();
    let conversationResult = await query(
      `SELECT id
       FROM conversations
       WHERE user_one_id = $1 AND user_two_id = $2
       LIMIT 1`,
      [userOneId, userTwoId]
    );

    let conversationId = conversationResult.rows[0]?.id;
    if (!conversationId) {
      conversationId = uuidv4();
      await query(
        `INSERT INTO conversations (
           id, user_one_id, user_two_id, user_one_last_read_at, user_two_last_read_at, created_at, updated_at
         ) VALUES ($1, $2, $3, NOW(), NOW(), NOW(), NOW())`,
        [conversationId, userOneId, userTwoId]
      );
    }

    const conversation = await getConversationByIdForUser(conversationId, user.id);
    res.status(conversationResult.rows[0] ? 200 : 201).json({ conversation });
  } catch (error) {
    console.error("Open direct conversation error:", error);
    res.status(500).json({ error: "Failed to open conversation" });
  }
});

app.get("/api/conversations/:id/messages", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const conversation = await getConversationRecordForUser(id, user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await query(
      `SELECT id, conversation_id, sender_id, content, created_at
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      messages: messages.rows.map(message => ({
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        created_at: new Date(message.created_at).getTime()
      }))
    });
  } catch (error) {
    console.error("Get conversation messages error:", error);
    res.status(500).json({ error: "Failed to get conversation messages" });
  }
});

app.post("/api/conversations/:id/messages", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const conversation = await getConversationRecordForUser(id, user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messageId = uuidv4();
    await query(
      `INSERT INTO conversation_messages (id, conversation_id, sender_id, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [messageId, id, user.id, content.trim()]
    );

    const lastReadColumn = conversation.user_one_id === user.id
      ? "user_one_last_read_at"
      : "user_two_last_read_at";

    await query(
      `UPDATE conversations
       SET last_message_at = NOW(),
           updated_at = NOW(),
           ${lastReadColumn} = NOW()
       WHERE id = $1`,
      [id]
    );

    res.status(201).json({
      message: {
        id: messageId,
        conversation_id: id,
        sender_id: user.id,
        content: content.trim(),
        created_at: Date.now()
      }
    });
  } catch (error) {
    console.error("Send conversation message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.put("/api/conversations/:id/read", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const conversation = await getConversationRecordForUser(id, user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const lastReadColumn = conversation.user_one_id === user.id
      ? "user_one_last_read_at"
      : "user_two_last_read_at";

    await query(
      `UPDATE conversations
       SET ${lastReadColumn} = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Mark conversation read error:", error);
    res.status(500).json({ error: "Failed to mark conversation as read" });
  }
});

app.delete("/api/conversations/:id", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const conversation = await getConversationRecordForUser(id, user.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await query("DELETE FROM conversations WHERE id = $1", [id]);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

app.put("/api/notifications/mark-read", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    await query("UPDATE notifications SET read = true WHERE user_id = $1", [user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    res.status(500).json({ error: "Failed to mark notifications" });
  }
});

app.get("/api/notifications/unread-count", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const result = await query("SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false", [user.id]);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

app.put("/api/users/activity", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await query("UPDATE users SET last_active = NOW() WHERE id = $1", [user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Update activity error:", error);
    res.status(500).json({ error: "Failed to update activity" });
  }
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack || err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

export default app;
