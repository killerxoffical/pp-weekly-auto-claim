/**
 * Interactive Token Finder & Achievement Unlocker for Termux (Node.js)
 * GitHub: https://github.com/killerxoffical/pp-weekly-auto-claim
 */

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ১. সিস্টেম বা রুট থেকে টোকেন খোঁজার ফাংশন
function extractTokensFromSystem() {
    console.log("\n🔍 ব্লুস্ট্যাকস / রুট থেকে অ্যাকাউন্ট ও টোকেন স্ক্যান করা হচ্ছে...");
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
        console.log("❌ রুট পারমিশন (su) পাওয়া যায়নি! দয়া করে রুট এনভায়রনমেন্টে রান করুন।");
        return [];
    }

    for (let db of dbs) {
        try {
            const tmpPath = path.join(require('os').tmpdir(), 'bs_acc.db');
            const cmd = `${selectedSu} -c "cat ${db}" > ${tmpPath}`;
            execSync(cmd);

            if (fs.existsSync(tmpPath)) {
                const grepCmd = `strings ${tmpPath} | grep -E '^ya29\\.'`;
                const result = execSync(grepCmd).toString();
                const tokens = result.split('\n').filter(t => t.startsWith('ya29.'));
                
                if (tokens.length > 0) {
                    directToks.push(...tokens);
                }
                fs.unlinkSync(tmpPath);
            }
        } catch (err) {}
    }

    return [...new Set(directToks)];
}

// ২. গুগল এপিআই দিয়ে অ্যাচিভমেন্ট আনলক করার ফাংশন
async function unlockAchievements(token) {
    console.log(`\n⚡ টোকেন ব্যবহার করে আনলক করা হচ্ছে...`);
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
                promptMenu();
                return;
            }
            if (res.statusCode !== 200) {
                console.log(`❌ API Error (HTTP ${res.statusCode}): ${body.substring(0, 100)}`);
                promptMenu();
                return;
            }

            try {
                const data = JSON.parse(body);
                const items = data.items || [];

                if (items.length === 0) {
                    console.log("⚠️ এই অ্যাকাউন্টে কোনো গেমের অ্যাচিভমেন্ট পাওয়া যায়নি!");
                    promptMenu();
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
                    promptMenu();
                    return;
                }

                console.log(`🎯 মোট ${updates.length}টি নতুন অ্যাচিভমেন্ট আনলক করা হচ্ছে...`);
                sendUnlockRequest(token, updates);

            } catch (e) {
                console.log("❌ JSON Parse Error:", e.message);
                promptMenu();
            }
        });
    });

    reqGet.on('error', (e) => {
        console.error(`❌ Request Error: ${e.message}`);
        promptMenu();
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
            promptMenu();
        });
    });

    reqPost.on('error', (e) => {
        console.error(`❌ Post Error: ${e.message}`);
        promptMenu();
    });

    reqPost.write(postData);
    reqPost.end();
}

// ৩. টার্মিনাল মেনু সিস্টেম
function promptMenu() {
    console.log("\n==========================================");
    console.log("   🎮 GOOGLE PLAY GAMES ACHIEVEMENT UNLOCKER");
    console.log("==========================================");
    console.log(" [xt] Auto Extract Token & Unlock Achievements");
    console.log(" [ex] Exit / Quit");
    console.log("==========================================");
    
    rl.question("👉 আপনার কমান্ড লিখুন (যেমন: xt): ", (answer) => {
        const cmd = answer.trim().toLowerCase();
        
        if (cmd === "xt") {
            const tokens = extractTokensFromSystem();
            if (tokens.length === 0) {
                console.log("❌ কোনো টোকেন পাওয়া যায়নি!");
                promptMenu();
            } else {
                console.log(`\n✅ মোট ${tokens.length}টি টোকেন পাওয়া গেছে:`);
                tokens.forEach((t, index) => {
                    console.log(` ${index + 1}. ${t}`);
                });
                // প্রথম টোকেনটি দিয়ে আনলক প্রসেস শুরু করবে
                unlockAchievements(tokens[0]);
            }
        } else if (cmd === "ex" || cmd === "exit") {
            console.log("👋 প্রগ্রাম বন্ধ করা হলো। ভালো থাকবেন!");
            rl.close();
            process.exit(0);
        } else {
            console.log("❌ ভুল কমান্ড! দয়া করে সঠিক কমান্ড দিন।");
            promptMenu();
        }
    });
}

// প্রোগ্রাম রান করার এন্ট্রি পয়েন্ট
console.clear();
promptMenu();
