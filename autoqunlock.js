/**
 * Interactive Google Play Achievement Unlocker
 * Updated Version: 3.0 (Clean Filter & Pure Auto Token)
 * GitHub: https://github.com/killerxoffical/pp-weekly-auto-claim
 */

const { execSync } = require('child_process');
const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function printHeader() {
    console.clear();
    console.log("\x1b[35m==================================================\x1b[0m");
    console.log("\x1b[36m   🎮 GOOGLE PLAY GAMES ACHIEVEMENT UNLOCKER\x1b[0m");
    console.log("\x1b[33m       [ Updated Version 3.0 - Clean Engine ]     \x1b[0m");
    console.log("\x1b[35m==================================================\x1b[0m");
    console.log(" \x1b[32m[a]\x1b[0m Auto Extract Token & Unlock Selected Account");
    console.log(" \x1b[32m[b]\x1b[0m Enter Bearer Token Manually (Optional)");
    console.log(" \x1b[31m[q]\x1b[0m Quit / Exit Program");
    console.log("\x1b[35m==================================================\x1b[0m");
}

function getSuBinary() {
    const suBins = ["/system/xbin/bstk/su", "/system/xbin/su", "/sbin/su", "su"];
    for (let su of suBins) {
        try {
            execSync(`${su} -v`, { stdio: 'ignore' });
            return su;
        } catch (e) {}
    }
    return null;
}

// শুধুমাত্র পিওর আসল জিমেইল অ্যাকাউন্টগুলো ফিল্টার করার ফাংশন
function getGoogleAccounts() {
    const su = getSuBinary();
    if (!su) return [];

    let pureEmails = new Set();
    
    // একাধিক সোর্স থেকে টেক্সট এক্সট্র্যাক্ট
    const commands = [
        `${su} -c "sqlite3 /data/system_ce/0/accounts_ce.db 'SELECT name FROM accounts WHERE type=\\\"com.google\\\"' 2>/dev/null"`,
        `${su} -c "sqlite3 /data/system/users/0/accounts.db 'SELECT name FROM accounts WHERE type=\\\"com.google\\\"' 2>/dev/null"`,
        `${su} -c "grep -Eroh '[a-zA-Z0-9._%+-]+@gmail\\.com' /data/data/com.google.android.gms/shared_prefs/ 2>/dev/null"`
    ];

    for (let cmd of commands) {
        try {
            const out = execSync(cmd).toString();
            const matches = out.match(/[a-zA-Z0-9._%+-]+@gmail\.com/gi);
            if (matches) {
                matches.forEach(email => {
                    const clean = email.trim().toLowerCase();
                    // সিস্টেম প্রিফিক্স এবং আবর্জনা পুরোপুরি ব্লক করা হলো
                    if (!clean.includes("last_config") && 
                        !clean.includes("scheduled_sync") && 
                        !clean.includes("focus_") && 
                        !clean.includes("feature_list") && 
                        !clean.includes("ongoing_sync") &&
                        !clean.includes("com.google")) {
                        pureEmails.add(clean);
                    }
                });
            }
        } catch (e) {}
    }

    return Array.from(pureEmails);
}

// নির্বাচিত অ্যাকাউন্টের লাইভ ya29 টোকেন ব্লুস্ট্যাকসের ক্যাশ ও ডাটাবেজ থেকে বের করা
function autoExtractTokenForAccount(email) {
    const su = getSuBinary();
    if (!su) return null;

    console.log(`\n\x1b[33m🔍 '${email}' এর লাইভ টোকেন ব্লুস্ট্যাকস থেকে বের করা হচ্ছে...\x1b[0m`);
    
    // ব্লুস্ট্যাকসের SQLite এবং ক্যাশ ডাটাবেজ স্ক্যান
    const tokenQueries = [
        `${su} -c "sqlite3 /data/system_ce/0/accounts_ce.db 'SELECT authtoken FROM authtokens WHERE authtoken LIKE \\\"ya29.%\\\"' 2>/dev/null"`,
        `${su} -c "sqlite3 /data/system/users/0/accounts.db 'SELECT authtoken FROM authtokens WHERE authtoken LIKE \\\"ya29.%\\\"' 2>/dev/null"`,
        `${su} -c "grep -Eroh 'ya29\\.[a-zA-Z0-9_\\-]+' /data/data/com.google.android.gms/ 2>/dev/null | head -n 1"`,
        `${su} -c "grep -Eroh 'ya29\\.[a-zA-Z0-9_\\-]+' /data/data/com.google.android.play.games/ 2>/dev/null | head -n 1"`
    ];

    for (let q of tokenQueries) {
        try {
            const res = execSync(q).toString().trim();
            const tokens = res.match(/ya29\.[a-zA-Z0-9_\-]+/g);
            if (tokens && tokens.length > 0) {
                return tokens[0];
            }
        } catch (e) {}
    }

    return null;
}

async function unlockAchievements(token) {
    console.log(`\n\x1b[32m⚡ টোকেন সফলভাবে ক্যাপচার হয়েছে! গুগল প্লে এপিআই কল করা হচ্ছে...\x1b[0m`);
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
                console.log("\n\x1b[31m❌ টোকেনটি Expired হয়ে গেছে! ব্লুস্ট্যাকসে গেমটি মিনিমাইজ করে আবার ওপেন করুন।\x1b[0m");
                setTimeout(promptMenu, 3000);
                return;
            }
            if (res.statusCode !== 200) {
                console.log(`\n\x1b[31m❌ API Error (HTTP ${res.statusCode}): ${body.substring(0, 100)}\x1b[0m`);
                setTimeout(promptMenu, 3000);
                return;
            }

            try {
                const data = JSON.parse(body);
                const items = data.items || [];

                if (items.length === 0) {
                    console.log("\n\x1b[33m⚠️ এই অ্যাকাউন্টে কোনো গেমের অ্যাচিভমেন্ট লিস্ট পাওয়া যায়নি!\x1b[0m");
                    setTimeout(promptMenu, 3000);
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
                    setTimeout(promptMenu, 3000);
                    return;
                }

                console.log(`\n\x1b[32m🎯 মোট ${updates.length}টি নতুন অ্যাচিভমেন্ট পাওয়া গেছে, আনলক করা হচ্ছে...\x1b[0m`);
                sendUnlockRequest(token, updates);

            } catch (e) {
                console.log("\n\x1b[31m❌ JSON Parse Error:\x1b[0m", e.message);
                setTimeout(promptMenu, 3000);
            }
        });
    });

    reqGet.on('error', (e) => {
        console.error(`\n\x1b[31m❌ Request Error:\x1b[0m`, e.message);
        setTimeout(promptMenu, 3000);
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
                    console.log(`\n\x1b[32m🎉 অভিনন্দন! মোট ${count}টি অ্যাচিভমেন্ট স্বয়ংক্রিয়ভাবে আনলক হয়েছে!\x1b[0m`);
                } catch (e) {
                    console.log("\n\x1b[32m🎉 সফলভাবে আনলক সম্পন্ন হয়েছে!\x1b[0m");
                }
            } else {
                console.log(`\n\x1b[31m❌ আনলক ফেইল (HTTP ${res.statusCode}): ${body.substring(0, 100)}\x1b[0m`);
            }
            setTimeout(promptMenu, 3500);
        });
    });

    reqPost.on('error', (e) => {
        console.error(`\n\x1b[31m❌ Post Error:\x1b[0m`, e.message);
        setTimeout(promptMenu, 3000);
    });

    reqPost.write(postData);
    reqPost.end();
}

function promptMenu() {
    printHeader();
    rl.question("\x1b[32m👉 আপনার অপশন সিলেক্ট করুন (a, b, q):\x1b[0m ", (answer) => {
        const cmd = answer.trim().toLowerCase();
        
        if (cmd === "a") {
            const accounts = getGoogleAccounts();
            if (accounts.length === 0) {
                console.log("\n\x1b[31m❌ কোনো পিওর জিমেইল অ্যাকাউন্ট পাওয়া যায়নি!\x1b[0m");
                setTimeout(promptMenu, 3000);
                return;
            }

            console.log("\n\x1b[36m📋 ব্লুস্ট্যাক্সে লগইন করা আসল জিমেইলসমূহ:\x1b[0m");
            accounts.forEach((acc, index) => {
                console.log(`  \x1b[33m[${index + 1}]\x1b[0m ${acc}`);
            });
            console.log("  \x1b[31m[0]\x1b[0m Back to Main Menu");

            rl.question("\n\x1b[32m👉 অ্যাকাউন্টের নাম্বার লিখুন (যেমন: 1, 2, 3...): \x1b[0m", async (choice) => {
                const choiceNum = parseInt(choice.trim());
                if (choiceNum === 0) {
                    promptMenu();
                    return;
                }

                if (choiceNum > 0 && choiceNum <= accounts.length) {
                    const chosenEmail = accounts[choiceNum - 1];
                    console.log(`\n\x1b[32m✅ সিলেক্ট করা হয়েছে:\x1b[0m ${chosenEmail}`);
                    
                    const autoToken = autoExtractTokenForAccount(chosenEmail);
                    if (autoToken) {
                        await unlockAchievements(autoToken);
                    } else {
                        console.log("\n\x1b[31m⚠️ লাইভ ya29 টোকেন ডাটাবেজে পাওয়া যায়নি! দয়া করে ব্লুস্ট্যাকসে একবার Google Play Games ওপেন রাখুন।\x1b[0m");
                        setTimeout(promptMenu, 3500);
                    }

                } else {
                    console.log("\n\x1b[31m❌ ভুল নাম্বার সিলেক্ট করেছেন!\x1b[0m");
                    setTimeout(promptMenu, 2500);
                }
            });

        } else if (cmd === "b") {
            rl.question("\n\x1b[36m👉 ম্যানুয়ালি আপনার ya29... টোকেনটি পেস্ট করুন:\x1b[0m ", (tokenInput) => {
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
