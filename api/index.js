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

app.get("/api/posts", async (req, res) => {
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

app.post("/api/posts/:id/comment", async (req, res) => {
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
