import { Client, GatewayIntentBits, Events, EmbedBuilder, AttachmentBuilder, SlashCommandBuilder, ChannelType, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { watched } from './watched.js';
import { extractItemNames, lookupItem } from './wowhead.js';
import { renderCard, closeBrowser } from './render.js';

const token = process.env.DISCORD_TOKEN;
if (!token) { console.error('DISCORD_TOKEN is not set'); process.exit(1); }
const maxItems = Math.max(1, Math.min(10, Number(process.env.MAX_ITEMS_PER_MESSAGE) || 3));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Tooltip picture (Wowhead look) when Chromium works, plain text embed otherwise.
async function card(item) {
  const e = new EmbedBuilder().setTitle(item.name).setURL(item.url).setColor(item.quality.color);
  try {
    const png = await renderCard(item, item.tooltipHtml);
    const name = `item-${item.id}.png`;
    e.setImage(`attachment://${name}`);
    return { embed: e, file: new AttachmentBuilder(png, { name }) };
  } catch (err) {
    console.error('render failed, falling back to text', item.id, err.message);
    e.setThumbnail(item.iconUrl);
    if (item.text) e.setDescription(item.text);
    return { embed: e };
  }
}

const commands = [
  new SlashCommandBuilder().setName('watch').setDescription('Post item cards for [Item Name] in a channel (default: this one)')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to watch').addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).setDMPermission(false),
  new SlashCommandBuilder().setName('unwatch').setDescription('Stop posting item cards in a channel (default: this one)')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to stop watching').addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).setDMPermission(false),
  new SlashCommandBuilder().setName('watched').setDescription('List the channels where item cards are posted')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels).setDMPermission(false),
].map((c) => c.toJSON());

async function registerCommands(guild) {
  try { await guild.commands.set(commands); } catch (err) { console.error('command registration failed for', guild.name, err.message); }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`logged in as ${c.user.tag}; watched channels: ${watched.size() ? watched.all().join(',') : 'none'}`);
  for (const g of c.guilds.cache.values()) await registerCommands(g);
});
client.on(Events.GuildCreate, registerCommands);

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand() || !i.guild) return;
  try {
    const ch = i.options.getChannel('channel') ?? i.channel;
    const tag = `<#${ch.id}>`;
    if (i.commandName === 'watch') {
      const fresh = watched.add(ch.id);
      await i.reply({ content: fresh ? `Watching ${tag} for [Item Name] links.` : `${tag} is already watched.`, flags: MessageFlags.Ephemeral });
    } else if (i.commandName === 'unwatch') {
      const had = watched.remove(ch.id);
      await i.reply({ content: had ? `No longer watching ${tag}.` : `${tag} was not watched.`, flags: MessageFlags.Ephemeral });
    } else if (i.commandName === 'watched') {
      const here = watched.all().filter((id) => i.guild.channels.cache.has(id));
      await i.reply({ content: here.length ? 'Watched channels: ' + here.map((id) => `<#${id}>`).join(', ') : 'No channels are watched. Use /watch in a channel.', flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    console.error('interaction failed', err);
  }
});

client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot || !msg.guild) return;
    if (!watched.has(msg.channelId)) return;
    const names = extractItemNames(msg.content, maxItems);
    if (!names.length) return;
    const items = (await Promise.all(names.map(lookupItem))).filter(Boolean);
    if (!items.length) return;
    const cards = await Promise.all(items.map(card));
    await msg.reply({
      embeds: cards.map((c) => c.embed),
      files: cards.map((c) => c.file).filter(Boolean),
      allowedMentions: { repliedUser: false },
    });
  } catch (err) {
    console.error('message handling failed', err);
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { client.destroy(); await closeBrowser(); process.exit(0); });
client.login(token);
