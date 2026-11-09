/**
 * Auto Token Finder & Achievement Unlocker (Node.js)
 * GitHub: https://github.com/killerxoffical/pp-weekly-auto-claim
 */

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ১. ব্লুস্ট্যাক্স রুট থেকে টোকেন বা অ্যাকাউন্ট খোঁজার ফাংশন
function extractTokensFromSystem() {
    console.log("🔍 ব্লুস্ট্যাকস থেকে অ্যাকাউন্ট ও টোকেন খোঁজা হচ্ছে...");
    const suBins = ["/system/xbin/bstk/su", "/system/xbin/su", "/sbin/su", "su"];
    const dbs = [
        "/data/system/users/0/accounts.db",
        "/data/system_ce/0/accounts_ce.db"
    ];
    
    let directToks = [];
    let selectedSu = null;

    for (let su of su_bins) {
        try {
            execSync(`${su} -v`, { stdio: 'ignore' });
            selectedSu = su;
            break;
        } catch (e) {}
    }

    if (!selectedSu) {
        console.log("⚠️ রুট পারমিশন (su) পাওয়া যায়নি! সরাসরি টোকেন ইনপুট দিতে হবে।");
        return [];
    }

    for (let db of dbs) {
        try {
            const tmpPath = path.join(require('os').tmpdir(), 'bs_acc.db');
            const cmd = `${selectedSu} -c "cat ${db}" > ${tmpPath}`;
            execSync(cmd);

            if (fs.existsSync(tmpPath)) {
                // SQLite ডাটাবেজ থেকে ya29 টোকেন খোঁজার জন্য বেসিক কমান্ড
                // (নোট: নোড জেএসে sqlite3 মডিউল না থাকলে চাইল্ড প্রসেস দিয়ে স্ট্রিং গ্র্যাব করা হয়)
                const grepCmd = `strings ${tmpPath} | grep -E '^ya29\\.'`;
                const result = execSync(grepCmd).toString();
                const tokens = result.split('\n').filter(t => t.startsWith('ya29.'));
                
                if (tokens.length > 0) {
                    directToks.push(...tokens);
                }
                fs.unlinkSync(tmpPath);
            }
        } catch (err) {
            // ইগনোর এরর
        }
    }

    return [...new Set(directToks)];
}

// ২. অ্যাচিভমেন্ট আনলক করার ফাংশন
async function unlockAchievements(token) {
    console.log(`⚡ টোকেন দিয়ে আনলক করা হচ্ছে: ${token.substring(0, 15)}...`);

    const optionsGet = {
        hostname: 'www.googleapis.com',
        path: '/games/v1/players/me/achievements?maxResults=200',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    const reqGet = https.request(optionsGet, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            if (res.statusCode === 401) {
                console.log("❌ টোকেনটি মেয়াদোত্তীর্ণ (Expired) অথবা ভুল!");
                return;
            }
            if (res.statusCode !== 200) {
                console.log(`❌ API Error (HTTP ${res.statusCode}): ${body.substring(0, 100)}`);
                return;
            }

            try {
                const data = JSON.parse(body);
                const items = data.items || [];

                if (items.length === 0) {
                    console.log("⚠️ এই অ্যাকাউন্টে কোনো গেমের অ্যাচিভমেন্ট পাওয়া যায়নি!");
                    return;
                }

                const updates = items
                    .filter(i => i.achievementState !== "UNLOCKED")
                    .map(i => ({
                        kind: "games#achievementUpdateRequest",
                        achievementId: i.id,
                        updateType: "UNLOCK"
                    }));

                if (updates.length === 0) {
                    console.log("✅ সবগুলো অ্যাচিভমেন্ট আগেই আনলক করা আছে!");
                    return;
                }

                console.log(`🎯 ${updates.length}টি নতুন অ্যাচিভমেন্ট পাওয়া গেছে, আনলক করা হচ্ছে...`);
                sendUnlockRequest(token, updates);

            } catch (e) {
                console.log("❌ JSON Parse Error:", e.message);
            }
        });
    });

    reqGet.on('error', (e) => {
        console.error(`❌ Request Error: ${e.message}`);
    });

    reqGet.end();
}

function sendUnlockRequest(token, updates) {
    const postData = JSON.stringify({
        kind: "games#achievementUpdateMultipleRequest",
        updates: updates
    });

    const optionsPost = {
        hostname: 'www.googleapis.com',
        path: '/games/v1/achievements/updateMultiple',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const reqPost = https.request(optionsPost, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const resData = JSON.parse(body);
                    const count = (resData.achievementUpdateStatuses || []).length;
                    console.log(`🎉 সফল! মোট ${count}টি অ্যাচিভমেন্ট আনলক হয়েছে!`);
                } catch (e) {
                    console.log("🎉 সফলভাবে রিকোয়েস্ট সম্পন্ন হয়েছে!");
                }
            } else {
                console.log(`❌ আনলক ফেইল (HTTP ${res.statusCode}): ${body.substring(0, 100)}`);
            }
        });
    });

    reqPost.on('error', (e) => {
        console.error(`❌ Post Error: ${e.message}`);
    });

    reqPost.write(postData);
    reqPost.end();
}

// ৩. মেইন প্রসেস রান করা
async function main() {
    console.log("🚀 অটো টোকেন ফাইন্ডার এবং আনলকার শুরু হয়েছে...");
    const tokens = extractTokensFromSystem();

    if (tokens.length === 0) {
        console.log("❌ সিস্টেম থেকে কোনো টোকেন খুঁজে পাওয়া যায়নি।");
        return;
    }

    console.log(`✅ মোট ${tokens.length}টি টোকেন পাওয়া গেছে।`);
    for (let token of tokens) {
        await unlockAchievement(token); // Fix typo call
    }
}

// ছোট ফাংশন নেম কারেকশন
async function unlockAchievement(token) {
    await unlockAchievements(token);
}

main();
