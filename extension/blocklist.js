// Native messaging name of the macOS companion that closes apps (see native/).
export const NATIVE_HOST = "com.jaydentheegg.lockin_filter";

// What the noise filter shuts out while a session is running. Each entry also
// covers its subdomains, so only list a parent domain when everything under it
// is entertainment: qq.com and baidu.com carry mail and search, so only their
// social, video and game hosts are named.

export const SITE_GROUPS = {
  social: [
    "facebook.com", "fb.com", "messenger.com", "instagram.com", "threads.net", "threads.com",
    "x.com", "twitter.com", "reddit.com", "redd.it", "tiktok.com", "snapchat.com",
    "pinterest.com", "tumblr.com", "linkedin.com", "quora.com", "bsky.app", "mastodon.social",
    "discord.com", "discord.gg", "discordapp.com", "telegram.org", "t.me", "whatsapp.com",
    "line.me", "vk.com", "9gag.com",
    "weibo.com", "weibo.cn", "xiaohongshu.com", "xhslink.com", "douyin.com", "iesdouyin.com",
    "kuaishou.com", "zhihu.com", "douban.com", "tieba.baidu.com", "hupu.com", "okjike.com",
    "qzone.qq.com", "wx.qq.com", "web.wechat.com",
  ],
  video: [
    "youtube.com", "youtu.be", "youtube-nocookie.com", "netflix.com", "twitch.tv", "kick.com",
    "hulu.com", "disneyplus.com", "primevideo.com", "max.com", "hbomax.com", "crunchyroll.com",
    "vimeo.com", "dailymotion.com",
    "bilibili.com", "b23.tv", "bilibili.tv", "acfun.cn", "iqiyi.com", "iq.com", "youku.com",
    "v.qq.com", "mgtv.com", "ixigua.com", "huya.com", "douyu.com", "cc.163.com",
  ],
  games: [
    "steampowered.com", "steamcommunity.com", "steamdb.info", "epicgames.com", "gog.com",
    "roblox.com", "minecraft.net", "battle.net", "blizzard.com", "ea.com", "ubisoft.com",
    "riotgames.com", "leagueoflegends.com", "playvalorant.com", "op.gg", "hoyoverse.com",
    "hoyolab.com", "mihoyo.com", "miyoushe.com", "xbox.com", "playstation.com", "nintendo.com",
    "chess.com", "lichess.org", "poki.com", "crazygames.com", "miniclip.com", "coolmathgames.com",
    "y8.com", "kongregate.com", "armorgames.com", "itch.io", "agar.io", "slither.io", "krunker.io",
    "4399.com", "7k7k.com", "game.qq.com", "lol.qq.com", "pvp.qq.com", "game.163.com",
    "taptap.cn", "taptap.io", "nga.cn", "ngabbs.com", "gamersky.com", "3dmgame.com",
    "17173.com", "ali213.net",
  ],
};

export const BLOCKED_DOMAINS = [...new Set(Object.values(SITE_GROUPS).flat())];

export function isBlockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return BLOCKED_DOMAINS.some(domain => host === domain || host.endsWith("." + domain));
}

export function isBlockedUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === "http:" || protocol === "https:") && isBlockedHost(hostname);
  } catch {
    return false;
  }
}

// macOS apps the companion host closes for as long as the filter is engaged.
// `exe` matches the executable path (an app bundle and everything nested in
// it); `args` matches the full command line, for games that run inside a
// generic runtime such as Java.
export const APP_RULES = [
  { label: "WeChat", exe: ["/WeChat.app/"] },
  { label: "QQ", exe: ["/QQ.app/"] },
  { label: "Discord", exe: ["/Discord.app/"] },
  { label: "Telegram", exe: ["/Telegram.app/", "/Telegram Desktop.app/"] },
  { label: "WhatsApp", exe: ["/WhatsApp.app/"] },
  { label: "Messenger", exe: ["/Messenger.app/"] },
  { label: "LINE", exe: ["/LINE.app/"] },
  { label: "Signal", exe: ["/Signal.app/"] },
  { label: "Xiaohongshu", exe: ["/rednote.app/", "/小红书.app/"] },
  { label: "Douyin", exe: ["/抖音.app/", "/Douyin.app/", "/TikTok.app/"] },
  { label: "Weibo", exe: ["/微博.app/", "/Weibo.app/"] },
  { label: "Bilibili", exe: ["/哔哩哔哩.app/", "/bilibili.app/"] },
  { label: "iQIYI", exe: ["/爱奇艺.app/", "/iQIYI.app/"] },
  { label: "Tencent Video", exe: ["/腾讯视频.app/", "/QQLive.app/"] },
  { label: "Youku", exe: ["/优酷.app/", "/Youku.app/"] },
  { label: "Douyu", exe: ["/斗鱼.app/", "/斗鱼直播.app/"] },
  { label: "Huya", exe: ["/虎牙直播.app/", "/虎牙.app/"] },
  { label: "Steam", exe: ["/Steam.app/"] },
  { label: "Steam game", exe: ["/steamapps/common/"] },
  { label: "Epic Games", exe: ["/Epic Games Launcher.app/", "/Shared/Epic Games/"] },
  { label: "Battle.net", exe: ["/Battle.net.app/", "/World of Warcraft/", "/Hearthstone/"] },
  { label: "League of Legends", exe: ["/League of Legends.app/", "/Riot Client.app/"] },
  { label: "Minecraft", exe: ["/Minecraft.app/", "/Prism Launcher.app/", "/Lunar Client.app/", "/CurseForge.app/"], args: ["net.minecraft.", "/.minecraft/"] },
  { label: "Roblox", exe: ["/Roblox.app/", "/RobloxPlayer.app/", "/RobloxStudio.app/"] },
  { label: "GOG Galaxy", exe: ["/GOG Galaxy.app/"] },
  { label: "Heroic", exe: ["/Heroic.app/"] },
  { label: "GeForce NOW", exe: ["/GeForceNOW.app/"] },
  { label: "Genshin Impact", exe: ["/Genshin Impact.app/", "/原神.app/"] },
  { label: "Honkai: Star Rail", exe: ["/崩坏：星穹铁道.app/", "/Honkai Star Rail.app/"] },
  { label: "OpenEmu", exe: ["/OpenEmu.app/"] },
  { label: "Chess", exe: ["/Applications/Chess.app/"] },
  { label: "Apple Games", exe: ["/Applications/Games.app/"] },
];
