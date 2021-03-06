const MsgBucket  = require('./messageBucket.js')
const webhookMgr = require('./webhook.js')

module.exports = (discord, pterodactyl, config) => {
    require('./onMessage.js')(discord, pterodactyl, config)

    let lang = {}
    require('./mcLang.js')(config).then((data) => lang = data)

    const bridge = config.bridge
    var logBucket  = new MsgBucket(bridge.updateInterval, true)
    var chatBucket = new MsgBucket(bridge.updateInterval)

    discord.on('ready', () => {
        if(discord._log)  logBucket.enable(discord._log)
        if(discord._chat) chatBucket.enable(discord._chat)
    })

    pterodactyl.on('console', function(con) {
        if(con.line.startsWith(bridge.minecraft.tellraw.prefix)) return

        logBucket.addMessage(con.line)

        const info = con.line.match(bridge.minecraft.info_regex)
        if(!discord._chat || !info || !lang.ready) return
        
        opts = {discord, bridge, chatBucket}

        const txt = info[1].match(lang.chat.txt)
        const me  = info[1].match(lang.chat.me)
        const say = info[1].match(lang.chat.say)

        if(txt) return chatMethod(txt[1], txt[2], opts)
        if(me)  return chatMethod(me[1], me[2], opts, 'me')
        if(say) {
            if(say[1] == "Server") chatBucket.addMessage(`> **${say[2]}**`)
            else chatMethod(say[1], say[2], opts, 'say')
            return
        }

        lang.regexs.some((regex) => {
            const match = info[1].match(regex)
            if(match && !match[0].includes(bridge.minecraft.action_blacklist_str)) {
                chatBucket.addMessage(`**${match[0]}**`)
                return true
            }
        }) 
    });

    pterodactyl.on('status', function(status) {
        chatBucket.addMessage(`__The server is now ${config.pterodactyl.status_texts[status.status]}.__`)
    })
}

function chatMethod(ply, msg, opts, type = null) {
    if(opts.discord._webhook) {
        if(type == 'me')  msg = `\* *${msg}*`
        if(type == 'say') msg = `> **${msg}**`
        webhookMgr(opts.discord._webhook, ply, msg, opts.bridge.webhook)
    } else {
        if(type == null)  msg = `**${ply}**: ${msg}`
        if(type == 'me')  msg = `\* ***${ply}** ${msg}*`
        if(type == 'say') msg = `**[${ply}] ${msg}**`
        opts.chatBucket.addMessage(msg)
    }
}
