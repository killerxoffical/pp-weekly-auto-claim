/**
 * Interactive Google Play Achievement Unlocker
 * Updated Version: 2.2 (Real Account Scanner & Live Fetch)
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

// কালারফুল ও প্রফেশনাল হেডার ডিজাইন (যেখানে নতুন ভার্সন শো করবে)
function printHeader() {
    console.clear();
    console.log("\x1b[35m==================================================\x1b[0m");
    console.log("\x1b[36m   🎮 GOOGLE PLAY GAMES ACHIEVEMENT UNLOCKER\x1b[0m");
    console.log("\x1b[33m             [ Updated Version 2.2 ]            \x1b[0m");
    console.log("\x1b[35m==================================================\x1b[0m");
    console.log(" \x1b[32m[a]\x1b[0m Select Account & Unlock Achievements");
    console.log(" \x1b[32m[b]\x1b[0m Enter Bearer Token Manually (ya29...)");
    console.log(" \x1b[31m[q]\x1b[0m Quit / Exit Program");
    console.log("\x1b[35m==================================================\x1b[0m");
}

// ব্লুস্ট্যাকসের রুট ডাটাবেজ থেকে রিয়েল জিমেইল অ্যাকাউন্টগুলো স্ক্যান করার ফাংশন
function getGoogleAccounts() {
    const su_bins = ["/system/xbin/bstk/su", "/system/xbin/su", "/sbin/su", "su"];
    const dbs = [
        "/data/system/users/0/accounts.db",
        "/data/system_ce/0/accounts_ce.db",
        "/data/system_de/0/accounts_de.db",
        "/data/system/accounts.db"
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
        return [];
    }

    for (let db of dbs) {
        try {
            const tmpPath = path.join(require('os').tmpdir(), 'bs_acc.db');
            const cmd = `${selectedSu} -c "cat ${db}" > ${tmpPath} 2>/dev/null`;
            execSync(cmd);

            if (fs.existsSync(tmpPath)) {
                if (fs.statSync(tmpPath).size > 100) {
                    const result = execSync(`strings ${tmpPath} | grep -E '^[a-zA-Z0-9._%+-]+@gmail\\.com$'`).toString();
                    const emails = result.split('\n').filter(e => e.includes('@gmail.com'));
                    if (emails.length > 0) {
                        accounts.push(...emails);
                    }
                }
                fs.unlinkSync(tmpPath);
            }
        } catch (err) {}
    }

    return [...new Set(accounts)];
}

// গুগল এপিআই দিয়ে অ্যাচিভমেন্ট আনলক করার ফাংশন
async function unlockAchievements(token) {
    console.log(`\n\x1b[33m⚡ কানেক্টিং গুগল এপিআই (Google Play Games API)...\x1b[0m`);
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
                console.log("\n\x1b[31m❌ টোকেনটি মেয়াদোত্তীর্ণ (Expired) অথবা ভুল!\x1b[0m");
                setTimeout(promptMenu, 2500);
                return;
            }
            if (res.statusCode !== 200) {
                console.log(`\n\x1b[31m❌ API Error (HTTP ${res.statusCode}): ${body.substring(0, 100)}\x1b[0m`);
                setTimeout(promptMenu, 2500);
                return;
            }

            try {
                const data = JSON.parse(body);
                const items = data.items || [];

                if (items.length === 0) {
                    console.log("\n\x1b[33m⚠️ এই অ্যাকাউন্টে কোনো গেমের অ্যাচিভমেন্ট পাওয়া যায়নি!\x1b[0m");
                    setTimeout(promptMenu, 2500);
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
                    console.log("\n\x1b[32m✅ সবগুলো অ্যাচিভমেন্ট আগেই আনলক করা আছে!\x1b[0m");
                    setTimeout(promptMenu, 2500);
                    return;
                }

                console.log(`\n\x1b[32m🎯 মোট ${updates.length}টি নতুন অ্যাচিভমেন্ট আনলক করা হচ্ছে...\x1b[0m`);
                sendUnlockRequest(token, updates);

            } catch (e) {
                console.log("\n\x1b[31m❌ JSON Parse Error:\x1b[0m", e.message);
                setTimeout(promptMenu, 2500);
            }
        });
    });

    reqGet.on('error', (e) => {
        console.error(`\n\x1b[31m❌ Request Error:\x1b[0m`, e.message);
        setTimeout(promptMenu, 2500);
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
                    console.log(`\n\x1b[32m🎉 সফল! মোট ${count}টি অ্যাচিভমেন্ট আনলক হয়েছে!\x1b[0m`);
                } catch (e) {
                    console.log("\n\x1b[32m🎉 সফলভাবে রিকোয়েস্ট সম্পন্ন হয়েছে!\x1b[0m");
                }
            } else {
                console.log(`\n\x1b[31m❌ আনলক ফেইল (HTTP ${res.statusCode}): ${body.substring(0, 100)}\x1b[0m`);
            }
            setTimeout(promptMenu, 3000);
        });
    });

    reqPost.on('error', (e) => {
        console.error(`\n\x1b[31m❌ Post Error:\x1b[0m`, e.message);
        setTimeout(promptMenu, 2000);
    });

    reqPost.write(postData);
    reqPost.end();
}

// প্রফেশনাল মেনু সিস্টেম
function promptMenu() {
    printHeader();
    rl.question("\x1b[32m👉 আপনার অপশন সিলেক্ট করুন (a, b, q):\x1b[0m ", (answer) => {
        const cmd = answer.trim().toLowerCase();
        
        if (cmd === "a") {
            console.log("\n\x1b[33m🔍 ব্লুস্ট্যাক্স থেকে রিয়েল জিমেইল অ্যাকাউন্ট স্ক্যান করা হচ্ছে...\x1b[0m");
            const accounts = getGoogleAccounts();
            
            if (accounts.length === 0) {
                console.log("\n\x1b[31m❌ সিস্টেম থেকে কোনো জিমেইল অ্যাকাউন্ট পাওয়া যায়নি!\x1b[0m");
                console.log("\x1b[33m💡 টিপস: আপনি অপশন [b] ব্যবহার করে ম্যানুয়ালি টোকেন দিতে পারেন।\x1b[0m");
                setTimeout(promptMenu, 3000);
                return;
            }

            console.log("\n\x1b[36m📋 ব্লুস্ট্যাক্সে লগইন করা রিয়েল অ্যাকাউন্টসমূহ:\x1b[0m");
            accounts.forEach((acc, index) => {
                const charKey = String.fromCharCode(97 + index); // a, b, c...
                console.log(`  \x1b[33m[${charKey}]\x1b[0m ${acc}`);
            });
            console.log("  \x1b[31m[x]\x1b[0m Back to Main Menu");

            rl.question("\n\x1b[32m👉 যেকোনো একটি অ্যাকাউন্ট সিলেক্ট করুন (যেমন: a, b):\x1b[0m ", (choice) => {
                const choiceTrim = choice.trim().toLowerCase();
                
                if (choiceTrim === "x") {
                    promptMenu();
                    return;
                }

                const selectedIndex = choiceTrim.charCodeAt(0) - 97;
                if (selectedIndex >= 0 && selectedIndex < accounts.length) {
                    const chosenEmail = accounts[selectedIndex];
                    console.log(`\n\x1b[32m✅ সিলেক্ট করা হয়েছে:\x1b[0m ${chosenEmail}`);
                    
                    rl.question(`\x1b[36m👉 '${chosenEmail}' এর ya29... টোকেনটি পেস্ট করুন:\x1b[0m `, (tokenInput) => {
                        const token = tokenInput.trim();
                        if (token.startsWith("ya29.")) {
                            unlockAchievements(token);
                        } else {
                            console.log("\n\x1b[31m❌ ভুল টোকেন! টোকেন অবশ্যই 'ya29.' দিয়ে শুরু হতে হবে।\x1b[0m");
                            setTimeout(promptMenu, 2500);
                        }
                    });

                } else {
                    console.log("\n\x1b[31m❌ ভুল সিলেকশন!\x1b[0m");
                    setTimeout(promptMenu, 2500);
                }
            });

        } else if (cmd === "b") {
            rl.question("\n\x1b[36m👉 আপনার ya29... টোকেনটি এখানে পেস্ট করুন:\x1b[0m ", (tokenInput) => {
                const token = tokenInput.trim();
                if (token.startsWith("ya29.")) {
                    unlockAchievements(token);
                } else {
                    console.log("\n\x1b[31m❌ ভুল টোকেন! টোকেন অবশ্যই 'ya29.' দিয়ে শুরু হতে হবে।\x1b[0m");
                    setTimeout(promptMenu, 2500);
                }
            });
        } else if (cmd === "q") {
            console.log("\n\x1b[31m👋 প্রোগ্রাম বন্ধ করা হলো। ভালো থাকবেন!\x1b[0m");
            rl.close();
            process.exit(0);
        } else {
            console.log("\n\x1b[31m❌ ভুল অপশন! সঠিক অপশন সিলেক্ট করুন।\x1b[0m");
            setTimeout(promptMenu, 2500);
        }
    });
}

promptMenu();
