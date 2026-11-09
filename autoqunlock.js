/**
 * Interactive Google Play Achievement Unlocker with Account Picker (Node.js)
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

// ১. ব্লুস্ট্যাকস থেকে লগইন করা গুগল অ্যাকাউন্টগুলোর (Gmail) লিস্ট বের করার ফাংশন
function getGoogleAccounts() {
    console.log("\n🔍 ব্লুস্ট্যাকস থেকে লগইন করা অ্যাকাউন্টগুলো খোঁজা হচ্ছে...");
    const su_bins = ["/system/xbin/bstk/su", "/system/xbin/su", "/sbin/su", "su"];
    const dbs = [
        "/data/system/users/0/accounts.db",
        "/data/system_ce/0/accounts_ce.db"
    ];
    
    let accounts = [];
    let selectedSu = null;

    for (let su of su_bins) {
        try {
            execSync(`${su} -v`, { stdio: 'ignore' });
            selectedSu = su;
            break;
        } catch (e) {}
    }

    if (!selectedSu) {
        console.log("❌ রুট পারমিশন (su) পাওয়া যায়নি!");
        return [];
    }

    for (let db of dbs) {
        try {
            const tmpPath = path.join(require('os').tmpdir(), 'bs_acc.db');
            const cmd = `${selectedSu} -c "cat ${db}" > ${tmpPath}`;
            execSync(cmd);

            if (fs.existsSync(tmpPath)) {
                // accounts.db থেকে জিমেইল নাম এক্সট্র্যাক্ট করা
                const grepCmd = `strings ${tmpPath} | grep -E '^[a-zA-Z0-9._%+-]+@gmail\\.com$'`;
                const result = execSync(grepCmd).toString();
                const emails = result.split('\n').filter(e => e.includes('@gmail.com'));
                
                if (emails.length > 0) {
                    accounts.push(...emails);
                }
                fs.unlinkSync(tmpPath);
            }
        } catch (err) {}
    }

    return [...new Set(accounts)];
}

// ২. গুগল এপিআই দিয়ে অ্যাচিভমেন্ট আনলক করার ফাংশন
async function unlockAchievements(token) {
    console.log(`\n⚡ টোকেন দিয়ে গেমের অ্যাচিভমেন্ট আনলক করা হচ্ছে...`);
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

// ৩. টার্মিনাল মেনু ও অ্যাকাউন্ট পিকার সিস্টেম
function promptMenu() {
    console.log("\n==========================================");
    console.log("   🎮 GOOGLE PLAY GAMES ACHIEVEMENT UNLOCKER");
    console.log("==========================================");
    console.log(" [xt] Select Account & Unlock Achievements");
    console.log(" [mt] Enter Bearer Token Manually (ya29...)");
    console.log(" [ex] Exit / Quit");
    console.log("==========================================");
    
    rl.question("👉 আপনার কমান্ড লিখুন: ", (answer) => {
        const cmd = answer.trim().toLowerCase();
        
        if (cmd === "xt") {
            const accounts = getGoogleAccounts();
            if (accounts.length === 0) {
                console.log("❌ কোনো জিমেইল অ্যাকাউন্ট পাওয়া যায়নি! দয়া করে [mt] দিয়ে ম্যানুয়াল টোকেন ব্যবহার করুন।");
                promptMenu();
                return;
            }

            console.log("\n📋 ব্লুস্ট্যাক্সে লগইন করা অ্যাকাউন্টসমূহ:");
            accounts.forEach((acc, index) => {
                const charKey = String.fromCharCode(97 + index); // a, b, c, d...
                console.log(`  [${charKey}] ${acc}`);
            });

            rl.question("\n👉 যেকোনো একটি অ্যাকাউন্ট সিলেক্ট করুন (যেমন: a, b): ", (choice) => {
                const selectedIndex = choice.trim().toLowerCase().charCodeAt(0) - 97;
                if (selectedIndex >= 0 && selectedIndex < accounts.length) {
                    const chosenEmail = accounts[selectedIndex];
                    console.log(`\n✅ আপনি সিলেক্ট করেছেন: ${chosenEmail}`);
                    
                    // অ্যান্ড্রয়েড সিকিউরিটির কারণে সরাসরি টোকেন জেনারেট করা না গেলে টোকেন ইনপুট চাওয়া হবে
                    rl.question(`👉 '${chosenEmail}' এর ya29... টোকেনটি এখানে পেস্ট করুন: `, (tokenInput) => {
                        const token = tokenInput.trim();
                        if (token.startsWith("ya29.")) {
                            unlockAchievements(token);
                        } else {
                            console.log("❌ ভুল টোকেন! এটি অবশ্যই 'ya29.' দিয়ে শুরু হতে হবে।");
                            promptMenu();
                        }
                    });

                } else {
                    console.log("❌ ভুল সিলেক্ট করেছেন!");
                    promptMenu();
                }
            });

        } else if (cmd === "mt") {
            rl.question("👉 আপনার ya29... টোকেনটি এখানে পেস্ট করুন: ", (tokenInput) => {
                const token = tokenInput.trim();
                if (token.startsWith("ya29.")) {
                    unlockAchievements(token);
                } else {
                    console.log("❌ ভুল টোকেন! টোকেন অবশ্যই 'ya29.' দিয়ে শুরু হতে হবে।");
                    promptMenu();
                }
            });
        } else if (cmd === "ex" || cmd === "exit") {
            console.log("👋 প্রগ্রাম বন্ধ করা হলো। ভালো থাকবেন!");
            rl.close();
            process.exit(0);
        } else {
            console.log("❌ ভুল কমান্ড!");
            promptMenu();
        }
    });
}

console.clear();
promptMenu();
