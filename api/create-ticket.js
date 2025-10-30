// api/create-ticket.js
// Delta Silence Ticket Creator → writes to GitHub JSON
// Deploy on Vercel. Requires environment variable: GITHUB_TOKEN

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Only POST allowed" });

  try {
    const { topic, username, subject, description } = req.body;

    if (!topic || !username || !subject || !description) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Generate unique ticket key
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let key = "TCK-";
    for (let i = 0; i < 8; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
      if (i === 3) key += "-";
    }

    const ticket = {
      key,
      topic,
      username,
      subject,
      description,
      status: "Open",
      createdAt: new Date().toISOString(),
    };

    // ---- GitHub repo config ----
    const owner = "Delta-Silence";
    const repo = "tickets";
    const path = "tickets.json";

    // Fetch existing JSON
    const gh = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!gh.ok) {
      return res
        .status(gh.status)
        .json({ error: "Failed to load GitHub file", details: await gh.text() });
    }
    const data = await gh.json();
    const existing = JSON.parse(
      Buffer.from(data.content, "base64").toString("utf8") || "[]"
    );

    // Append ticket
    existing.push(ticket);

    // Commit update
    const newContent = Buffer.from(JSON.stringify(existing, null, 2)).toString(
      "base64"
    );

    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: `New ticket: ${ticket.key}`,
          content: newContent,
          sha: data.sha,
        }),
      }
    );

    if (!commitRes.ok) {
      return res
        .status(commitRes.status)
        .json({ error: "GitHub commit failed", details: await commitRes.text() });
    }

    return res.status(200).json({ success: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}
