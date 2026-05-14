import express from "express";
import cors from "cors";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { query } from "./utils/db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "TwoWor1ds API Server", status: "ok" });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

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

// ===== AUTH ROUTES =====

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existingUsers = await query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existingUsers.rows.length > 0) return res.status(409).json({ error: "Email already registered" });

    const userId = uuidv4();
    const avatarSeed = uuidv4();
    const displayName = nickname || `用户${Math.floor(Math.random() * 9999)}`;
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

    await query(
      "INSERT INTO users (id, email, password_hash, nickname, avatar_seed, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [userId, email.toLowerCase(), passwordHash, displayName, avatarSeed]
    );

    const token = crypto.randomBytes(32).toString("hex");
    await query("INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, userId]);

    res.status(201).json({
      success: true,
      user: { id: userId, email: email.toLowerCase(), nickname: displayName, avatarSeed },
      token
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const users = await query(
      "SELECT id, email, nickname, avatar_seed FROM users WHERE email = $1 AND password_hash = $2",
      [email.toLowerCase(), passwordHash]
    );
    if (users.rows.length === 0) return res.status(401).json({ error: "Invalid email or password" });

    const user = users.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    await query("INSERT INTO auth_tokens (token, user_id, created_at) VALUES ($1, $2, NOW())", [token, user.id]);

    res.json({
      success: true,
      user: { id: user.id, email: user.email, nickname: user.nickname, avatarSeed: user.avatar_seed },
      token
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/auth/verify", async (req, res) => {
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

app.post("/auth/logout", async (req, res) => {
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

app.post("/auth/quickstart", async (req, res) => {
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

// ===== POSTS ROUTES =====

app.get("/posts", async (req, res) => {
  try {
    const { tag, sort = "latest", limit = 50, offset = 0 } = req.query;
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
      `SELECT p.id, p.content, p.tags, p.likes_count, p.comments_count, p.created_at,
              u.id as user_id, u.nickname, u.avatar_seed
       FROM posts p JOIN users u ON p.user_id = u.id
       ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const postIds = posts.rows.map(p => p.id);
    let commentsMap = {};
    if (postIds.length > 0) {
      const comments = await query(
        `SELECT c.id, c.post_id, c.content, c.created_at,
                u.id as user_id, u.nickname, u.avatar_seed
         FROM comments c JOIN users u ON c.user_id = u.id
         WHERE c.post_id = ANY($1) ORDER BY c.created_at ASC`,
        [postIds]
      );
      for (const c of comments.rows) {
        if (!commentsMap[c.post_id]) commentsMap[c.post_id] = [];
        commentsMap[c.post_id].push({
          id: c.id,
          content: c.content,
          user_id: c.user_id,
          nickname: c.nickname,
          avatar_seed: c.avatar_seed,
          created_at: new Date(c.created_at).getTime()
        });
      }
    }

    res.json({
      posts: posts.rows.map(p => ({
        id: p.id, content: p.content, tags: p.tags,
        likes_count: p.likes_count, comments_count: p.comments_count,
        user_id: p.user_id, nickname: p.nickname, avatar_seed: p.avatar_seed,
        created_at: new Date(p.created_at).getTime(),
        comments: commentsMap[p.id] || []
      }))
    });
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ error: "Failed to get posts" });
  }
});

app.post("/posts", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { content, tags } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: "Content is required" });
    if (content.length > 500) return res.status(400).json({ error: "Content too long" });

    const postId = uuidv4();
    const tagsArray = Array.isArray(tags) ? tags : [];

    await query(
      "INSERT INTO posts (id, user_id, content, tags, likes_count, comments_count, created_at) VALUES ($1, $2, $3, $4, 0, 0, NOW())",
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

app.delete("/posts/:id", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const posts = await query("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (posts.rows.length === 0) return res.status(404).json({ error: "Post not found" });
    if (posts.rows[0].user_id !== user.id) return res.status(403).json({ error: "Not authorized" });

    await query("DELETE FROM comments WHERE post_id = $1", [id]);
    await query("DELETE FROM likes WHERE post_id = $1", [id]);
    await query("DELETE FROM posts WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

app.post("/posts/:id/like", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const existingLike = await query("SELECT id FROM likes WHERE post_id = $1 AND user_id = $2", [id, user.id]);

    if (existingLike.rows.length > 0) {
      await query("DELETE FROM likes WHERE post_id = $1 AND user_id = $2", [id, user.id]);
      await query("UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1", [id]);
      res.json({ liked: false });
    } else {
      await query("INSERT INTO likes (post_id, user_id, created_at) VALUES ($1, $2, NOW())", [id, user.id]);
      await query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1", [id]);
      res.json({ liked: true });
    }
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
});

app.post("/posts/:id/comment", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { content } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: "Comment content is required" });

    const commentId = uuidv4();
    await query(
      "INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES ($1, $2, $3, $4, NOW())",
      [commentId, id, user.id, content.trim()]
    );
    await query("UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1", [id]);

    res.status(201).json({
      success: true,
      comment: {
        id: commentId, content: content.trim(),
        user: { id: user.id, nickname: user.nickname, avatarSeed: user.avatar_seed },
        createdAt: Date.now()
      }
    });
  } catch (error) {
    console.error("Comment post error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// ===== CHAT ROUTES =====

app.get("/chat/sessions", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const sessions = await query(
      `SELECT cs.id, cs.participant_id, cs.last_message_at, cs.created_at,
              u.nickname as participant_nickname, u.avatar_seed as participant_avatar_seed,
              (SELECT content FROM messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM chat_sessions cs JOIN users u ON cs.participant_id = u.id
       WHERE cs.user_id = $1 ORDER BY cs.last_message_at DESC NULLS LAST`,
      [user.id]
    );

    res.json({
      sessions: sessions.rows.map(s => ({
        id: s.id, participantId: s.participant_id, participantNickname: s.participant_nickname,
        participantAvatarSeed: s.participant_avatar_seed, lastMessage: s.last_message,
        lastMessageAt: s.last_message_at ? new Date(s.last_message_at).getTime() : null,
        createdAt: new Date(s.created_at).getTime()
      }))
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    res.status(500).json({ error: "Failed to get chat sessions" });
  }
});

app.post("/chat/sessions", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { participantId } = req.body;
    if (!participantId) return res.status(400).json({ error: "Participant ID is required" });

    const existingSessions = await query(
      "SELECT id FROM chat_sessions WHERE user_id = $1 AND participant_id = $2",
      [user.id, participantId]
    );
    if (existingSessions.rows.length > 0) return res.json({ sessionId: existingSessions.rows[0].id, created: false });

    const sessionId = uuidv4();
    await query(
      "INSERT INTO chat_sessions (id, user_id, participant_id, last_message_at, created_at) VALUES ($1, $2, $3, NOW(), NOW())",
      [sessionId, user.id, participantId]
    );
    res.status(201).json({ sessionId, created: true });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ error: "Failed to create chat session" });
  }
});

app.get("/chat/sessions/:sessionId/messages", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { sessionId } = req.params;
    const { limit = 50, before } = req.query;

    let beforeClause = "";
    const params = [sessionId, parseInt(limit)];
    if (before) {
      beforeClause = "AND created_at < $3";
      params.push(new Date(parseInt(before)));
    }

    const messages = await query(
      `SELECT id, sender_id, content, created_at FROM messages
       WHERE session_id = $1 ${beforeClause}
       ORDER BY created_at DESC LIMIT $2`,
      params
    );

    res.json({
      messages: messages.rows.map(m => ({
        id: m.id, senderId: m.sender_id, content: m.content,
        createdAt: new Date(m.created_at).getTime()
      })).reverse(),
      hasMore: messages.rows.length === parseInt(limit)
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

app.post("/chat/sessions/:sessionId/messages", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { sessionId } = req.params;
    const { content } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: "Message content is required" });

    const messageId = uuidv4();
    await query(
      "INSERT INTO messages (id, session_id, sender_id, content, created_at) VALUES ($1, $2, $3, $4, NOW())",
      [messageId, sessionId, user.id, content.trim()]
    );
    await query("UPDATE chat_sessions SET last_message_at = NOW() WHERE id = $1", [sessionId]);

    res.status(201).json({
      message: { id: messageId, senderId: user.id, content: content.trim(), createdAt: Date.now() }
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.delete("/chat/sessions/:sessionId", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { sessionId } = req.params;
    await query("DELETE FROM messages WHERE session_id = $1", [sessionId]);
    await query("DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2", [sessionId, user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ error: "Failed to delete chat session" });
  }
});

// ===== USERS ROUTES =====

app.get("/users/online", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await query(
      `SELECT id, nickname, avatar_seed,
              (SELECT COUNT(*) FROM posts WHERE user_id = users.id) as posts_count
       FROM users WHERE id != $1 AND last_active > $2 ORDER BY RANDOM() LIMIT 20`,
      [user.id, fiveMinutesAgo]
    );

    res.json({
      users: onlineUsers.rows.map(u => ({
        id: u.id, nickname: u.nickname, avatarSeed: u.avatar_seed, postsCount: parseInt(u.posts_count)
      }))
    });
  } catch (error) {
    console.error("Get online users error:", error);
    res.status(500).json({ error: "Failed to get online users" });
  }
});

app.post("/users/match", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "Target user ID is required" });

    const targetUsers = await query("SELECT id, nickname, avatar_seed FROM users WHERE id = $1", [targetUserId]);
    if (targetUsers.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const targetUser = targetUsers.rows[0];
    const existingSessions = await query(
      "SELECT id FROM chat_sessions WHERE (user_id = $1 AND participant_id = $2) OR (user_id = $2 AND participant_id = $1)",
      [user.id, targetUserId]
    );

    let sessionId;
    if (existingSessions.rows.length > 0) {
      sessionId = existingSessions.rows[0].id;
    } else {
      sessionId = uuidv4();
      await query(
        "INSERT INTO chat_sessions (id, user_id, participant_id, last_message_at, created_at) VALUES ($1, $2, $3, NOW(), NOW())",
        [sessionId, user.id, targetUserId]
      );
    }

    res.json({
      success: true, sessionId,
      matchedUser: { id: targetUser.id, nickname: targetUser.nickname, avatarSeed: targetUser.avatar_seed }
    });
  } catch (error) {
    console.error("Match user error:", error);
    res.status(500).json({ error: "Failed to match user" });
  }
});

app.post("/users/random-match", async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const randomUsers = await query(
      `SELECT id, nickname, avatar_seed FROM users
       WHERE id != $1 AND last_active > NOW() - INTERVAL '30 minutes'
       AND id NOT IN (SELECT participant_id FROM chat_sessions WHERE user_id = $1 UNION SELECT user_id FROM chat_sessions WHERE participant_id = $1)
       ORDER BY RANDOM() LIMIT 1`,
      [user.id]
    );

    let matchedUser, sessionId;

    if (randomUsers.rows.length > 0) {
      matchedUser = randomUsers.rows[0];
      const existingSessions = await query(
        "SELECT id FROM chat_sessions WHERE user_id = $1 AND participant_id = $2",
        [user.id, matchedUser.id]
      );
      if (existingSessions.rows.length > 0) {
        sessionId = existingSessions.rows[0].id;
      } else {
        sessionId = uuidv4();
        await query(
          "INSERT INTO chat_sessions (id, user_id, participant_id, last_message_at, created_at) VALUES ($1, $2, $3, NOW(), NOW())",
          [sessionId, user.id, matchedUser.id]
        );
      }
    } else {
      const anyUsers = await query(
        "SELECT id, nickname, avatar_seed FROM users WHERE id != $1 ORDER BY RANDOM() LIMIT 1",
        [user.id]
      );
      if (anyUsers.rows.length === 0) return res.status(404).json({ error: "No users available" });
      matchedUser = anyUsers.rows[0];
      sessionId = uuidv4();
      await query(
        "INSERT INTO chat_sessions (id, user_id, participant_id, last_message_at, created_at) VALUES ($1, $2, $3, NOW(), NOW())",
        [sessionId, user.id, matchedUser.id]
      );
    }

    res.json({
      success: true, sessionId,
      matchedUser: { id: matchedUser.id, nickname: matchedUser.nickname, avatarSeed: matchedUser.avatar_seed }
    });
  } catch (error) {
    console.error("Random match error:", error);
    res.status(500).json({ error: "Failed to match user" });
  }
});

app.put("/users/activity", async (req, res) => {
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

// ===== ERROR HANDLER =====

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack || err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

export default app;
