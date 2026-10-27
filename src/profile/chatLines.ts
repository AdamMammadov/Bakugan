/**
 * What CPU brawlers say, in the languages players write in here: Azerbaijani, Turkish, Russian and English.
 * `{name}` fills in a fact (see chatBrain.ts); a line whose facts are not known is skipped.
 */

export type Lang = 'az' | 'tr' | 'ru' | 'en'

export type LineKey =
  | 'hello'
  | 'greet'
  | 'greetSalam'
  | 'greetMood'
  | 'greetBattle'
  | 'mood'
  | 'moodBrawled'
  | 'moodBack'
  | 'moodGood'
  | 'moodBad'
  | 'doing'
  | 'doingBrawled'
  | 'whoami'
  | 'from'
  | 'isBot'
  | 'battleYes'
  | 'battleGroup'
  | 'battleWhen'
  | 'battleDay'
  | 'battleAt'
  | 'battleBusy'
  | 'battleNow'
  | 'battleNo'
  | 'inviteFriend'
  | 'inviteAdd'
  | 'inviteHere'
  | 'bakugan'
  | 'bakuganMine'
  | 'bakuganLead'
  | 'bakuganEvo'
  | 'bakuganNoEvo'
  | 'bakuganG'
  | 'bakuganWho'
  | 'compare'
  | 'compareEven'
  | 'leadAnswer'
  | 'leadUnknown'
  | 'attr'
  | 'attrSame'
  | 'attrMine'
  | 'cards'
  | 'shop'
  | 'shopBp'
  | 'pass'
  | 'rank'
  | 'stats'
  | 'team'
  | 'favorite'
  | 'whoTop'
  | 'leader'
  | 'leaderMe'
  | 'leaderYou'
  | 'members'
  | 'joinIn'
  | 'joinOut'
  | 'joinNone'
  | 'leave'
  | 'compliment'
  | 'insult'
  | 'thanks'
  | 'luck'
  | 'bye'
  | 'night'
  | 'laugh'
  | 'newbie'
  | 'win'
  | 'loss'
  | 'tipWrap'
  | 'tips'
  | 'yes'
  | 'no'
  | 'number'
  | 'numberG'
  | 'numberBig'
  | 'why'
  | 'when'
  | 'where'
  | 'who'
  | 'qUnknown'
  | 'unknown'
  | 'chatter'
  | 'welcome'
  | 'recruited'
  | 'joined'
  | 'friendHello'
  | 'inviteNo'
  | 'inviteBusy'
  | 'inviteLate'
  | 'inviteOk'
  | 'promoted'

type Lines = Record<LineKey, string[]>

const en: Lines = {
  hello: ['Hey {me}!', 'Hi {me}!', 'Yo {me}!'],
  greet: ['Hey {me}! 👋', 'Hi {me}, good to see you!', 'Hello {me}! 😊'],
  greetSalam: ['Hey {me}! 👋', 'Hi {me}, good to see you!'],
  greetMood: ['Hey {me}! How are you?', 'Hi {me}! How’s it going?'],
  greetBattle: ['Hey {me}! Up for a brawl?', 'Hi! {lead} is itching for a brawl. You in?'],
  mood: ['Doing great, thanks! Training with {lead}.', 'Pretty good! Grinding the Season Pass.', 'All good, ready to brawl!'],
  moodBrawled: ['Great, thanks! Just finished a brawl.', 'Good! Already {today} brawls today.'],
  moodBack: ['How about you?', 'And you?', 'How are you doing, {me}?'],
  moodGood: ['Nice, glad to hear it!', 'Awesome! 😊', 'Good to hear, {me}!'],
  moodBad: ['Sorry to hear that… a brawl might cheer you up? 😉', 'Hang in there! Want a quick brawl to shake it off?'],
  doing: ['Training with {lead}.', 'Sorting my Gate Cards.', 'Window-shopping in the shop 😄'],
  doingBrawled: ['Just got out of a brawl, catching my breath 😄', '{today} brawls today, taking a short break.'],
  whoami: [
    'I’m {botFull}, I brawl {El}. My lead Bakugan is {lead}.',
    '{botFull}! {El} attribute, rank {tier}. Nice to meet you 😄',
  ],
  from: ['From Vestroia, obviously 😄 Well, from the arena anyway.', 'Wherever there’s a brawl! 😄'],
  isBot: ['Yep, I’m a CPU brawler 🤖 Still won’t go easy on you!', 'CPU, yes. Doesn’t mean I can’t beat you 😄'],
  battleYes: ['Let’s go! {lead} is ready.', 'A brawl? Always! 💪', 'I’m in! Let’s see who’s stronger.'],
  battleGroup: ['Me! {lead} needs the XP.', 'I’m up for it! 🙋'],
  battleWhen: ['Sure! When works for you?', 'Deal! What time?'],
  battleDay: ['{When} works! What time?', '{When}? Sure. What time suits you?'],
  battleAt: [
    '{When} — deal! ⏰ {lead} will be ready.',
    '{When} works for me. See you in the arena!',
    'OK, {when}. Don’t forget!',
  ],
  battleBusy: ['{When} is tough for me… an hour later?', 'Ah, I’m busy {when}. Another time?'],
  battleNow: ['Right now then! 💪', 'Now works!'],
  battleNo: ['No worries, another time 🙂', 'OK, ping me whenever.', 'Sure, later then!'],
  inviteFriend: [
    'Invite me from my profile on the FRIENDS page (⚔ INVITE TO BATTLE).',
    'Hit ⚔ INVITE TO BATTLE on the FRIENDS page and I’m there!',
  ],
  inviteAdd: ['Add me as a friend first (+ ADD FRIEND on my profile), then invite me from the FRIENDS page!'],
  inviteHere: ['Hit ⚔ INVITE TO BATTLE up on my profile and I’m in!', 'Press ⚔ INVITE TO BATTLE above, I’m ready!'],
  bakugan: ['{B}: {Battr} attribute, {bG}G ({bBrawl}G on a Gate Card). Brawler: {bBrawler}.', '{B}? Great pick! {Battr}, {bG}G.'],
  bakuganMine: ['{B}? It’s on my team! 😎 {Battr}, {bG}G.', 'I brawl with {B} too — {bG}G of pure {Battr}.'],
  bakuganLead: ['{B} is my lead Bakugan! {bG}G.', 'That’s my lead! {B} never lets me down.'],
  bakuganEvo: ['{B} evolves like this: {bEvos}.', 'Evolution line: {bEvos}.'],
  bakuganNoEvo: ['{B} doesn’t evolve, but {bG}G isn’t bad.'],
  bakuganG: [
    '{B}: {bG}G in ball form, {bBrawl}G on a Gate Card. Strongest form: {bMax} ({bMaxG}G).',
    '{B} starts at {bG}G and reaches {bMaxG}G as {bMax}.',
  ],
  bakuganWho: ['In the anime {bBrawler} brawled with {B}.'],
  compare: [
    '{A} ({aG}G) vs {B2} ({b2G}G) — {Win} is stronger on paper, but cards change a lot.',
    '{Win} has more G ({A} {aG}G, {B2} {b2G}G). Timing your cards matters more though!',
  ],
  compareEven: ['{A} and {B2} both have {aG}G — it all comes down to cards!'],
  leadAnswer: ['{B}! Nice pick — {Battr}, {bG}G.', 'Ooh, {B}! I’d love to brawl against that.'],
  leadUnknown: ['Hmm, don’t know that one. Mine is {lead}.'],
  attr: [
    '{E} — the {Enative} attribute. Strongest there: {eTop} ({eTopG}G).',
    '{E}? I brawl {El}, but {E} is strong too. Top pick: {eTop}.',
  ],
  attrSame: ['{E}! I brawl {E} too 🔥', 'Fellow {E} brawler! 💪'],
  attrMine: ['I brawl {El}! My lead is {lead}.', '{El} all the way 🔥'],
  cards: [
    'My favourite card for {lead}: {card} ({cardLabel}).',
    'Cards win brawls — play them at the right moment. I love {card} ({cardLabel}).',
  ],
  shop: [
    'Bakugan of your own attribute cost {own} BP in the shop, the others {other} BP.',
    'Shop prices: {own} BP for your attribute, {other} BP for the rest. New picks every day.',
  ],
  shopBp: ['You’ve got {bp} BP right now.'],
  pass: [
    'Season {season} still has {days} days to go. Daily challenges level the Pass fastest.',
    'Season {season} ends in {days} days — the Pass Bakugan are worth it!',
  ],
  rank: ['I’m {tier}: {rating} BR, {score} points, #{pos} in the rankings.', 'Right now: {tier}, #{pos} with {score} points.'],
  stats: ['{wins} wins, {losses} losses. {today} brawls today.', '{wins} wins so far 💪'],
  team: ['My team: {team}.', 'I brawl with {team}.'],
  favorite: [
    'My favourite? {lead}, of course — {leadG}G.',
    'The strongest {El} Bakugan is {elTop} ({elTopG}G), but my heart is with {lead}.',
  ],
  whoTop: ['Our strongest is {top} — {topScore} points.', '{top}, no contest: {topScore} points.'],
  leader: ['[{tag}] is led by {leader} ★', 'Our leader is {leader} ★'],
  leaderMe: ['That’s me 😄 Need something?', 'Me! [{tag}] is my clan.'],
  leaderYou: ['You are, {me} 😄'],
  members: ['There are {count} of us in [{tag}].', '{count} members right now!'],
  joinIn: ['You’re already one of us, {me}! 😄'],
  joinOut: ['Find [{tag}] on the CLANS page and hit JOIN — you’re welcome!'],
  joinNone: ['I’m not in a clan yet. Found one and I might join 😉'],
  leave: ['Don’t go! 😢 [{tag}] will miss you.', 'Your call, but the door’s always open.'],
  compliment: ['Thanks, {me}! 😊', 'Appreciate it! You’re not bad yourself 😄', 'Thanks! I’ll prove it next brawl 💪'],
  insult: [
    'Easy there 🙂 We’re all here to have fun.',
    'Chill, {me}. Let’s settle it in the arena 😉',
    'Let’s keep it friendly, OK?',
  ],
  thanks: ['Anytime! 😊', 'No problem!', 'You got it, {me}.'],
  luck: ['Thanks! Good luck to you too 🍀', 'Luck’s on our side! 💪'],
  bye: ['See you, {me}! 👋', 'Later! Brawl hard.', 'Bye {me}, good luck out there!'],
  night: ['Good night, {me}! 🌙'],
  laugh: ['😂', 'Haha, true!', 'LOL 😄'],
  newbie: ['Welcome, {me}! Which Bakugan do you brawl with?', 'Nice to meet you, {me}! What’s your lead Bakugan?'],
  win: ['GG, {me}! 🔥', 'Nice win! Keep that streak going.', 'Huge! That’s how a Battle Brawler does it.'],
  loss: [
    'Happens to the best of us. Next one’s yours!',
    'Shake it off — every loss is XP for your Bakugan.',
    'Tough one. Try a different Gate Card next time?',
  ],
  tipWrap: ['Tip: {tip}', 'Here’s one: {tip}'],
  tips: [
    'Bakugan of your own attribute are cheaper in the shop.',
    'a Card Key unlocks the next ability card right away.',
    'daily challenges level the Season Pass the fastest.',
    'evolve your lead Bakugan first — it carries the team.',
    'save XP Boosts for a long brawl session.',
  ],
  yes: ['👍', 'Nice!', 'Cool!'],
  no: ['OK, no worries.', 'Got it 🙂'],
  number: ['{n}? Noted 🤔', '{n}, huh? Interesting.'],
  numberG: ['{n}G? Not bad! My {lead} has {leadG}G.'],
  numberBig: ['Whoa, {n}G! My {lead} only has {leadG}G 😅'],
  why: ['Good question… I think it all comes down to the Gate Cards.', 'Why? Because brawling is life 😄'],
  when: ['Not sure exactly, but I’m usually around in the evenings.', 'Soon! 😄'],
  where: ['In the arena, where else 😄'],
  who: ['Hmm, maybe {someone}? 😄', 'Ask {someone}, they’d know.'],
  qUnknown: ['Good question, but I’m not sure about «{snip}» 🤔', 'Hmm, «{snip}»? No idea, honestly.'],
  unknown: [
    '«{snip}» — didn’t quite get that 😅 Say it another way?',
    'Hmm, «{snip}»… what do you mean?',
    'Not sure what you mean by «{snip}», but I’m always up for a brawl with {lead} 😄',
  ],
  chatter: [
    'Gate Card, set!',
    'Who’s up for a training brawl?',
    'Just unlocked a new ability card for {lead}!',
    'Season Pass grind is real today 😅',
    'Anyone else saving BP for a new Bakugan?',
    '{El} power! 💪',
    '{lead}, stand!',
    'GG to everyone brawling today.',
  ],
  welcome: [
    'Welcome to [{tag}], {me}! Glad to have you.',
    'A new brawler! Welcome aboard, {me}.',
    'Hey {me}, welcome! Ready to brawl with us?',
  ],
  recruited: ['Thanks for the invite, {me}! Let’s brawl.', 'Joined up! {lead} and I are ready.'],
  joined: ['Hi everyone! Happy to be in [{tag}] 👋', 'Hey all! {lead} and I are ready to brawl.'],
  friendHello: ['Hey {me}, thanks for the add! 🙌 Up for a brawl sometime?', 'Hi {me}! Friends now 😄 Fancy a brawl?'],
  inviteNo: [
    'gotta go eat, tomorrow?',
    'about to log off, later?',
    'my {lead} needs a rest 😅 next time!',
    'can’t right now, tomorrow?',
  ],
  inviteBusy: ['in the middle of a ranked match, later!', 'mid-brawl right now, give me a few min!'],
  inviteLate: ['Sorry, I was mid-brawl! Invite me again 🙂', 'Just saw your invite, I was in a match. Next time!'],
  inviteOk: ['ok, next time 🙂', 'No worries, next time!'],
  promoted: ['Officer? Thanks for the trust, {me}! 💪', 'Thanks, {me}! I’ll look after the clan.'],
}

const az: Lines = {
  hello: ['Salam, {me}!', 'Salam!', 'Ooo, {me}, salam!'],
  greet: ['Salam, {me}! 👋', 'Salam! Xoş gördük, {me}.', 'Salam-salam! 😊'],
  greetSalam: ['Əleykümsalam, {me}! 👋', 'Əleykümsalam! Xoş gördük, {me}.'],
  greetMood: ['Salam, {me}! Necəsən?', 'Salam! Nə var, nə yox?', 'Xoş gördük, {me}! İşlər necədir?'],
  greetBattle: ['Salam, {me}! Bir döyüş edək?', 'Salam! {lead} döyüşə hazırdır. Gəlirsən?'],
  mood: [
    'Yaxşıyam, sağ ol! {lead} ilə məşq edirəm.',
    'Pis deyil, sağ ol. Season Pass-ı qaldırıram.',
    'Əla, sağ ol! Döyüşə hazıram.',
  ],
  moodBrawled: ['Əla, sağ ol! İndicə bir döyüşü bitirdim.', 'Yaxşıyam! Bu gün artıq {today} döyüş etmişəm.'],
  moodBack: ['Sən necəsən?', 'Bəs sən necəsən?', 'Sənin işlərin necədir, {me}?'],
  moodGood: ['Əla, sevindim! 😊', 'Super, belə də olmalıdır!', 'Bunu eşitmək xoşdur, {me}!'],
  moodBad: ['Təəssüf… Bir döyüş kefini qaldırar? 😉', 'Narahat olma, keçəcək. Bir döyüş edək?'],
  doing: ['{lead} ilə məşq edirəm.', 'Gate Card-larımı qaydaya salıram.', 'Mağazaya baxıram, nə alım deyə fikirləşirəm 😄'],
  doingBrawled: ['İndicə döyüşdən çıxdım, nəfəsimi dərirəm 😄', 'Bu gün {today} döyüş etmişəm, bir az dincəlirəm.'],
  whoami: [
    'Mən {botFull}, {El} atributunda döyüşürəm. Lider Bakuganım — {lead}.',
    '{botFull}! {El} brawleri, rütbəm: {tier}. Tanış olaq 😄',
  ],
  from: ['Vestroiadan, əlbəttə 😄 Yaxşı, arenadan.', 'Harda döyüş varsa, oradan 😄'],
  isBot: ['Hə, mən CPU brawlerəm 🤖 Amma döyüşdə güzəşt yoxdur!', 'Bəli, CPU-yam. Bu, səni məğlub etməyimə mane olmayacaq 😄'],
  battleYes: ['Gəl, hazıram! {lead} artıq səbirsizlənir.', 'Döyüş? Həmişə! 💪', 'Razıyam! Görək kim güclüdür.'],
  battleGroup: ['Mən! {lead} XP istəyir.', 'Mən varam! 🙋'],
  battleWhen: ['Gəl! Nə vaxt sənə uyğundur?', 'Olar! Nə vaxt döyüşək?'],
  battleDay: ['{When} olar! Saat neçədə?', '{When}? Razıyam. Saat neçədə sənə uyğundur?'],
  battleAt: ['{When} — razılaşdıq! ⏰ {lead} hazır olacaq.', '{When} mənə uyğundur. Arenada görüşərik!', 'Oldu, {when}. Unutma!'],
  battleBusy: ['{When} bir az çətindir… bir saat sonra olar?', 'Ah, {when} işim var. Başqa vaxt olar?'],
  battleNow: ['Onda elə indi! 💪', 'İndi olar!'],
  battleNo: ['Problem deyil, başqa vaxt 🙂', 'Oldu, nə vaxt istəsən yaz.', 'Yaxşı, onda sonra!'],
  inviteFriend: [
    'FRIENDS səhifəsində profilimdən ⚔ INVITE TO BATTLE düyməsini bas — gəlirəm!',
    'Məni FRIENDS səhifəsindən döyüşə çağır, hazıram!',
  ],
  inviteAdd: ['Əvvəlcə məni dost əlavə et (profilimdə + ADD FRIEND), sonra FRIENDS səhifəsindən döyüşə çağır!'],
  inviteHere: ['Yuxarıda ⚔ INVITE TO BATTLE düyməsini bas, gəlirəm!', 'Profilimdəki ⚔ INVITE TO BATTLE düyməsini bas — hazıram!'],
  bakugan: [
    '{B}: {Battr} atributu, {bG}G (Gate Card üstündə {bBrawl}G). Brawleri: {bBrawler}.',
    '{B}? Yaxşı seçimdir! {Battr}, {bG}G.',
  ],
  bakuganMine: ['{B}? O mənim komandamdadır! 😎 {Battr}, {bG}G.', 'Mən də {B} ilə döyüşürəm — {bG}G, təmiz {Battr} gücü.'],
  bakuganLead: ['{B} mənim lider Bakuganımdır! {bG}G.', 'O mənim liderimdir! {B} məni heç vaxt yarı yolda qoymur.'],
  bakuganEvo: ['{B} belə təkamül edir: {bEvos}.', 'Təkamül zənciri: {bEvos}.'],
  bakuganNoEvo: ['{B} təkamül etmir, amma {bG}G pis deyil.'],
  bakuganG: [
    '{B}: top formasında {bG}G, Gate Card üstündə {bBrawl}G. Ən güclü forması — {bMax} ({bMaxG}G).',
    '{B} {bG}G ilə başlayır, {bMax} kimi {bMaxG}G-yə çatır.',
  ],
  bakuganWho: ['Animedə {B} ilə {bBrawler} döyüşürdü.'],
  compare: [
    '{A} ({aG}G) və {B2} ({b2G}G) — kağız üzərində {Win} güclüdür, amma kartlar çox şeyi dəyişir.',
    '{Win} daha çox G-yə malikdir ({A} {aG}G, {B2} {b2G}G). Amma kartları vaxtında oynamaq daha vacibdir!',
  ],
  compareEven: ['{A} və {B2} — hər ikisi {aG}G. Hər şeyi kartlar həll edir!'],
  leadAnswer: ['{B}! Gözəl seçim — {Battr}, {bG}G.', 'Ooo, {B}! Ona qarşı döyüşmək maraqlı olardı.'],
  leadUnknown: ['Hmm, onu tanımıram. Mənimki — {lead}.'],
  attr: [
    '{E} — {Enative} atributu. Ən güclüsü: {eTop} ({eTopG}G).',
    '{E}? Mən {El} oynayıram, amma {E} də güclüdür. Ən yaxşı seçim: {eTop}.',
  ],
  attrSame: ['{E}! Mən də {E} oynayıram 🔥', 'Mən də {E} brawleriyəm! 💪'],
  attrMine: ['Mən {El} oynayıram! Liderim — {lead}.', '{El}, əlbəttə 🔥'],
  cards: [
    '{lead} üçün ən sevdiyim kart: {card} ({cardLabel}).',
    'Döyüşü kartlar udur — onları vaxtında oyna. Mənim favoritim: {card} ({cardLabel}).',
  ],
  shop: [
    'Mağazada öz atributunun Bakuganı {own} BP, başqa atributlarınkı {other} BP-dir.',
    'Qiymətlər: öz atributun üçün {own} BP, qalanları {other} BP. Hər gün yeni təkliflər olur.',
  ],
  shopBp: ['Səndə indi {bp} BP var.'],
  pass: [
    'Season {season} hələ {days} gün davam edəcək. Gündəlik tapşırıqlar Pass-ı ən tez qaldırır.',
    'Season {season} {days} günə bitir — Pass Bakuganlarına dəyər!',
  ],
  rank: [
    'Rütbəm: {tier}. {rating} BR, {score} xal, reytinqdə {posAz} yerdəyəm.',
    'Hazırda reytinqdə {posAz} yerdəyəm, {score} xalla.',
  ],
  stats: [
    '{wins} qələbə, {losses} məğlubiyyət. Bu gün {today} döyüş etmişəm.',
    '{wins} qələbə, {losses} məğlubiyyət. İndiyədək {wins} qələbəm var 💪',
  ],
  team: ['Komandam: {team}.', 'Mən {team} ilə döyüşürəm.'],
  favorite: ['Favoritim? Əlbəttə, {lead} — {leadG}G.', 'Ən güclü {El} Bakuganı {elTop} ({elTopG}G), amma ürəyim {lead} ilədir.'],
  whoTop: ['Ən güclümüz {top} — {topScore} xal.', 'Şübhəsiz, {top}: {topScore} xal.'],
  leader: ['[{tag}] klanını {leader} idarə edir ★', 'Liderimiz: {leader} ★'],
  leaderMe: ['Lider mənəm 😄 Nəsə lazımdır?', 'Mən! [{tag}] mənim klanımdır.'],
  leaderYou: ['Lider sənsən də, {me} 😄'],
  members: ['[{tag}] klanında {count} nəfərik.', 'Hazırda {count} üzvümüz var!'],
  joinIn: ['Sən artıq bizimləsən, {me}! 😄'],
  joinOut: ['CLANS səhifəsində [{tag}] klanını tap və JOIN bas — xoş gəlmisən!'],
  joinNone: ['Hələ heç bir klanda deyiləm. Klan qursan, qoşula bilərəm 😉'],
  leave: ['Getmə! 😢 [{tag}] sənsiz darıxacaq.', 'Qərar sənindir, amma qapımız həmişə açıqdır.'],
  compliment: [
    'Sağ ol, {me}! Ürəyimi qızdırdın 😊',
    'Təşəkkürlər! Sən də pis deyilsən 😄',
    'Çox sağ ol! Növbəti döyüşdə göstərərəm 💪',
  ],
  insult: [
    'Sakit ol, dostum 🙂 Burada hamımız əylənmək üçünük.',
    'Əsəbiləşmə, {me}. Gəl bunu arenada həll edək 😉',
    'Belə danışmayaq, yaxşı? Dostcasına olsun.',
  ],
  thanks: ['Dəyməz! 😊', 'Nə danışırsan, həmişə!', 'Buyur, {me}!'],
  luck: ['Sağ ol! Sənə də uğurlar 🍀', 'Uğur bizimlə olsun! 💪'],
  bye: ['Hələlik, {me}! 👋', 'Görüşərik! Döyüşlərdə uğurlar.', 'Sağ ol, hələlik!'],
  night: ['Gecən xeyrə, {me}! 🌙'],
  laugh: ['😂', 'Haha, düz deyirsən!', '😄😄'],
  newbie: ['Xoş gəlmisən, {me}! Hansı Bakuganla döyüşürsən?', 'Tanış olmağıma şadam, {me}! Lider Bakuganın hansıdır?'],
  win: ['Təbriklər, {me}! 🔥', 'Əla qələbədir! Belə davam et.', 'Super! Əsl Battle Brawler kimi!'],
  loss: [
    'Olur belə, növbəti dəfə sən qalib gələcəksən!',
    'Narahat olma — hər məğlubiyyət Bakuganına XP verir.',
    'Ağır oldu. Növbəti dəfə başqa Gate Card yoxla?',
  ],
  tipWrap: ['Məsləhətim: {tip}', 'Bax: {tip}'],
  tips: [
    'öz atributunun Bakuganları mağazada daha ucuzdur.',
    'Card Key növbəti ability kartını dərhal açır.',
    'gündəlik tapşırıqlar Season Pass-ı ən tez qaldırır.',
    'əvvəlcə lider Bakuganını təkamül etdir — komandanı o aparır.',
    'XP Boost-ları uzun döyüş seriyası üçün saxla.',
  ],
  yes: ['👍', 'Əla!', 'Oldu!'],
  no: ['Yaxşı, problem deyil.', 'Başa düşdüm 🙂'],
  number: ['{n}? Maraqlıdır 🤔', '{n} — yadda saxladım!'],
  numberG: ['{n}G? Pis deyil! Mənim {lead}: {leadG}G.'],
  numberBig: ['Vay, {n}G! Mənim {lead} cəmi {leadG}G-dir 😅'],
  why: ['Yaxşı sualdır… məncə, hər şeyi Gate Card-lar həll edir.', 'Niyə? Çünki Bakugan həyatdır 😄'],
  when: ['Dəqiq bilmirəm, amma axşamlar adətən buradayam.', 'Tezliklə! 😄'],
  where: ['Arenada, harda olacam ki 😄'],
  who: ['Hmm, bəlkə {someone}? 😄', '{someone} bilər yəqin.'],
  qUnknown: ['Yaxşı sualdır, amma «{snip}» barədə dəqiq bilmirəm 🤔', 'Hmm, «{snip}»? Açığı, bilmirəm.'],
  unknown: [
    '«{snip}» — tam başa düşmədim 😅 Bir az başqa cür yazarsan?',
    'Hmm, «{snip}»… nə demək istədin?',
    '«{snip}» deyirsən? Başa düşmədim, amma {lead} ilə döyüşə həmişə hazıram 😄',
  ],
  chatter: [
    'Gate Card, set!',
    'Kim məşq döyüşünə hazırdır? 💪',
    '{lead} üçün yeni ability kartı açdım!',
    'Bu gün Season Pass-da yaxşı irəliləyiş var 😅',
    'Kimsə BP yığır? Mən yeni Bakugan üçün yığıram.',
    '{El} gücü! 💪',
    '{lead}, ayağa qalx!',
    'Bu gün döyüşən hər kəsə GG!',
  ],
  welcome: [
    '[{tag}] klanına xoş gəlmisən, {me}! 🎉',
    'Xoş gəldin, {me}! Səni görməyə şadıq.',
    'Yeni brawler! Xoş gəlmisən, {me} 👋',
  ],
  recruited: ['Dəvət üçün sağ ol, {me}! Döyüşək!', 'Qoşuldum! {lead} və mən hazırıq.'],
  joined: ['Hamıya salam! [{tag}] klanında olmağa şadam 👋', 'Salam, dostlar! {lead} və mən döyüşə hazırıq.'],
  friendHello: ['Salam, {me}! Dostluq üçün sağ ol 🙌 Bir gün döyüşək?', 'Salam, {me}! Artıq dostuq 😄 Döyüşə nə deyirsən?'],
  inviteNo: [
    'yeməyə getməliyəm, sabah?',
    'az qala çıxıram, sonra?',
    '{lead} bir az dincəlsin 😅 növbəti dəfə!',
    'indi olmur, sabah edək?',
  ],
  inviteBusy: ['reytinq döyüşünün ortasındayam, sonra!', 'indi döyüşdəyəm, bir neçə dəqiqə gözlə!'],
  inviteLate: ['Bağışla, döyüşdə idim! Yenə dəvət et 🙂', 'Dəvətini indi gördüm, matçda idim. Növbəti dəfə!'],
  inviteOk: ['yaxşı, növbəti dəfə 🙂', 'Problem deyil, sonra!'],
  promoted: ['Zabit? Etimad üçün sağ ol, {me}! 💪', 'Sağ ol, {me}! Klana yaxşı baxacağam.'],
}

const tr: Lines = {
  hello: ['Selam {me}!', 'Selam!', 'Merhaba {me}!'],
  greet: ['Selam {me}! 👋', 'Merhaba {me}, hoş geldin!', 'Selam selam! 😊'],
  greetSalam: ['Aleykümselam {me}! 👋', 'Aleykümselam! Hoş geldin {me}.'],
  greetMood: ['Selam {me}! Nasılsın?', 'Merhaba! Naber?'],
  greetBattle: ['Selam {me}! Bir maç atalım mı?', 'Selam! {lead} savaşa hazır. Geliyor musun?'],
  mood: ['İyiyim, sağ ol! {lead} ile antrenman yapıyorum.', 'Fena değil, Season Pass kasıyorum 😅', 'Süperim, savaşa hazırım!'],
  moodBrawled: ['Harika, sağ ol! Az önce bir maç bitirdim.', 'İyiyim! Bugün zaten {today} maç yaptım.'],
  moodBack: ['Sen nasılsın?', 'Sen nasılsın {me}?'],
  moodGood: ['Süper, sevindim! 😊', 'Harika!', 'Bunu duymak güzel {me}!'],
  moodBad: ['Üzüldüm… Bir maç moralini düzeltir mi? 😉', 'Takma kafana, geçer. Bir maç atalım mı?'],
  doing: ['{lead} ile antrenman yapıyorum.', 'Gate Card’larımı düzenliyorum.', 'Mağazaya bakıyorum 😄'],
  doingBrawled: ['Az önce maçtan çıktım, nefesleniyorum 😄', 'Bugün {today} maç yaptım, biraz dinleniyorum.'],
  whoami: [
    'Ben {botFull}, {El} oynuyorum. Lider Bakugan’ım {lead}.',
    '{botFull}! {El} brawler’ı, rütbem: {tier}. Memnun oldum 😄',
  ],
  from: ['Vestroia’dan tabii ki 😄 Yani arenadan.', 'Nerede savaş varsa oradan 😄'],
  isBot: ['Evet, CPU brawler’ım 🤖 Ama savaşta acımam!', 'CPU’yum, evet. Bu seni yenmeme engel değil 😄'],
  battleYes: ['Hadi, hazırım! {lead} sabırsızlanıyor.', 'Savaş mı? Her zaman! 💪', 'Varım! Bakalım kim güçlü.'],
  battleGroup: ['Ben! {lead} XP istiyor.', 'Ben varım! 🙋'],
  battleWhen: ['Olur! Ne zaman uygunsun?', 'Tamam! Saat kaçta?'],
  battleDay: ['{When} olur! Saat kaçta?', '{When} mi? Tamam. Saat kaç uygun?'],
  battleAt: ['{When} — anlaştık! ⏰ {lead} hazır olacak.', '{When} bana uyar. Arenada görüşürüz!', 'Tamam, {when}. Unutma!'],
  battleBusy: ['{When} biraz zor… bir saat sonra olur mu?', 'Ah, {when} işim var. Başka zaman?'],
  battleNow: ['O zaman hemen şimdi! 💪', 'Şimdi olur!'],
  battleNo: ['Sorun değil, başka zaman 🙂', 'Tamam, ne zaman istersen yaz.', 'Peki, sonra o zaman!'],
  inviteFriend: ['FRIENDS sayfasında profilimden ⚔ INVITE TO BATTLE’a bas, geliyorum!'],
  inviteAdd: ['Önce beni arkadaş ekle (profilimde + ADD FRIEND), sonra FRIENDS sayfasından savaşa davet et!'],
  inviteHere: ['Yukarıdaki ⚔ INVITE TO BATTLE’a bas, geliyorum!'],
  bakugan: [
    '{B}: {Battr} özelliği, {bG}G (Gate Card’da {bBrawl}G). Brawler’ı: {bBrawler}.',
    '{B} mi? Güzel seçim! {Battr}, {bG}G.',
  ],
  bakuganMine: ['{B} mi? Benim takımımda! 😎 {Battr}, {bG}G.', 'Ben de {B} ile savaşıyorum — {bG}G saf {Battr} gücü.'],
  bakuganLead: ['{B} benim lider Bakugan’ım! {bG}G.', 'O benim liderim! {B} beni hiç yarı yolda bırakmaz.'],
  bakuganEvo: ['{B} şöyle evrimleşir: {bEvos}.', 'Evrim zinciri: {bEvos}.'],
  bakuganNoEvo: ['{B} evrimleşmiyor ama {bG}G fena değil.'],
  bakuganG: ['{B}: top formunda {bG}G, Gate Card’da {bBrawl}G. En güçlü formu: {bMax} ({bMaxG}G).'],
  bakuganWho: ['Animede {B} ile {bBrawler} savaşıyordu.'],
  compare: ['{A} ({aG}G) ve {B2} ({b2G}G) — kâğıt üstünde {Win} daha güçlü, ama kartlar çok şey değiştirir.'],
  compareEven: ['{A} ve {B2} — ikisi de {aG}G. Her şeyi kartlar belirler!'],
  leadAnswer: ['{B}! Güzel seçim — {Battr}, {bG}G.', 'Ooo, {B}! Ona karşı savaşmak isterdim.'],
  leadUnknown: ['Hmm, onu tanımıyorum. Benimki {lead}.'],
  attr: [
    '{E} — {Enative} özelliği. En güçlüsü: {eTop} ({eTopG}G).',
    '{E} mi? Ben {El} oynuyorum ama {E} de güçlü. En iyi seçim: {eTop}.',
  ],
  attrSame: ['{E}! Ben de {E} oynuyorum 🔥'],
  attrMine: ['Ben {El} oynuyorum! Liderim {lead}.', '{El}, tabii ki 🔥'],
  cards: [
    '{lead} için en sevdiğim kart: {card} ({cardLabel}).',
    'Maçı kartlar kazandırır — doğru anda oyna. Favorim: {card} ({cardLabel}).',
  ],
  shop: [
    'Mağazada kendi özelliğinin Bakugan’ı {own} BP, diğerleri {other} BP.',
    'Fiyatlar: kendi özelliğin için {own} BP, gerisi {other} BP. Her gün yeni teklifler var.',
  ],
  shopBp: ['Şu an {bp} BP’n var.'],
  pass: ['Season {season} bitmesine {days} gün var. Günlük görevler Pass’ı en hızlı yükseltir.'],
  rank: ['Rütbem: {tier}. {rating} BR, {score} puan, sıralamada {pos}. sıradayım.'],
  stats: ['{wins} galibiyet, {losses} mağlubiyet. Bugün {today} maç yaptım.', '{wins} galibiyet, {losses} mağlubiyet.'],
  team: ['Takımım: {team}.', '{team} ile savaşıyorum.'],
  favorite: ['Favorim mi? Tabii ki {lead} — {leadG}G.', 'En güçlü {El} Bakugan’ı {elTop} ({elTopG}G), ama kalbim {lead} ile.'],
  whoTop: ['En güçlümüz {top} — {topScore} puan.'],
  leader: ['[{tag}] klanını {leader} yönetiyor ★', 'Liderimiz: {leader} ★'],
  leaderMe: ['Lider benim 😄 Bir şey mi lazım?'],
  leaderYou: ['Lider sensin {me} 😄'],
  members: ['[{tag}] klanında {count} kişiyiz.', 'Şu an {count} üyemiz var!'],
  joinIn: ['Zaten bizimlesin {me}! 😄'],
  joinOut: ['CLANS sayfasında [{tag}] klanını bul ve JOIN’e bas — hoş geldin!'],
  joinNone: ['Henüz bir klanda değilim. Klan kurarsan katılabilirim 😉'],
  leave: ['Gitme ya! 😢 [{tag}] seni özleyecek.', 'Karar senin ama kapımız hep açık.'],
  compliment: ['Sağ ol {me}! 😊', 'Teşekkürler! Sen de fena değilsin 😄', 'Çok sağ ol! Bir sonraki maçta göstereceğim 💪'],
  insult: [
    'Sakin ol dostum 🙂 Burada hepimiz eğlenmek için varız.',
    'Gerilme {me}, bunu arenada çözelim 😉',
    'Böyle konuşmayalım, tamam mı?',
  ],
  thanks: ['Rica ederim! 😊', 'Ne demek, her zaman!', 'Buyur {me}!'],
  luck: ['Sağ ol! Sana da bol şans 🍀'],
  bye: ['Görüşürüz {me}! 👋', 'Hoşça kal! Maçlarda bol şans.'],
  night: ['İyi geceler {me}! 🌙'],
  laugh: ['😂', 'Haha, aynen!', '😄😄'],
  newbie: ['Hoş geldin {me}! Hangi Bakugan ile oynuyorsun?', 'Memnun oldum {me}! Lider Bakugan’ın hangisi?'],
  win: ['Tebrikler {me}! 🔥', 'Harika galibiyet! Böyle devam.', 'Süper! Tam bir Battle Brawler gibi!'],
  loss: [
    'Olur böyle, bir dahakine sen kazanırsın!',
    'Takma — her mağlubiyet Bakugan’ına XP verir.',
    'Zor maçmış. Bir dahakine başka Gate Card dene?',
  ],
  tipWrap: ['Tavsiyem: {tip}', 'Bak: {tip}'],
  tips: [
    'kendi özelliğinin Bakugan’ları mağazada daha ucuz.',
    'Card Key bir sonraki yetenek kartını hemen açar.',
    'günlük görevler Season Pass’ı en hızlı yükseltir.',
    'önce lider Bakugan’ını evrimleştir — takımı o taşır.',
  ],
  yes: ['👍', 'Süper!', 'Tamam!'],
  no: ['Tamam, sorun değil.', 'Anladım 🙂'],
  number: ['{n} mi? İlginç 🤔'],
  numberG: ['{n}G mi? Fena değil! Benim {lead}: {leadG}G.'],
  numberBig: ['Vay, {n}G! Benim {lead} sadece {leadG}G 😅'],
  why: ['Güzel soru… bence her şeyi Gate Card’lar belirliyor.', 'Neden mi? Çünkü Bakugan hayattır 😄'],
  when: ['Tam bilmiyorum ama akşamları genelde buradayım.', 'Yakında! 😄'],
  where: ['Arenada tabii ki 😄'],
  who: ['Hmm, belki {someone}? 😄'],
  qUnknown: ['Güzel soru ama «{snip}» hakkında emin değilim 🤔'],
  unknown: ['«{snip}» — tam anlamadım 😅 Biraz açar mısın?', 'Hmm, «{snip}»… ne demek istedin?'],
  chatter: [
    'Gate Card, set!',
    'Antrenman maçına kim hazır? 💪',
    '{lead} için yeni bir yetenek kartı açtım!',
    '{El} gücü! 💪',
    'Bugün savaşan herkese GG!',
  ],
  welcome: ['[{tag}] klanına hoş geldin {me}! 🎉', 'Hoş geldin {me}! Seni gördüğümüze sevindik.'],
  recruited: ['Davet için sağ ol {me}! Hadi savaşalım!', 'Katıldım! {lead} ve ben hazırız.'],
  joined: ['Herkese selam! [{tag}] klanında olmaktan mutluyum 👋'],
  friendHello: ['Selam {me}! Eklediğin için sağ ol 🙌 Bir gün kapışalım mı?'],
  inviteNo: [
    'yemeğe gitmem lazım, yarın?',
    'çıkmak üzereyim, sonra?',
    '{lead} biraz dinlensin 😅 bir dahaki sefere!',
    'şu an olmaz, yarın?',
  ],
  inviteBusy: ['dereceli maçın ortasındayım, sonra!', 'şu an maçtayım, birkaç dakika ver!'],
  inviteLate: ['Kusura bakma, maçtaydım! Tekrar davet et 🙂', 'Davetini şimdi gördüm, maçtaydım. Bir dahaki sefere!'],
  inviteOk: ['tamam, bir dahaki sefere 🙂', 'Sorun değil, sonra!'],
  promoted: ['Subay mı? Güvenin için sağ ol, {me}! 💪', 'Sağ ol, {me}! Klana iyi bakacağım.'],
}

const ru: Lines = {
  hello: ['Привет, {me}!', 'Привет!'],
  greet: ['Привет, {me}! 👋', 'Здорово, {me}!', 'Привет-привет! 😊'],
  greetSalam: ['Салам, {me}! 👋'],
  greetMood: ['Привет, {me}! Как дела?', 'Привет! Как ты?'],
  greetBattle: ['Привет, {me}! Сразимся?', 'Привет! {lead} рвётся в бой. Ты как?'],
  mood: ['Всё хорошо, спасибо! Тренируюсь с {lead}.', 'Неплохо, качаю Season Pass.', 'Отлично, готов к бою!'],
  moodBrawled: ['Отлично, спасибо! Только что закончил бой.', 'Хорошо! Боёв сегодня: {today}.'],
  moodBack: ['А у тебя как?', 'А ты как, {me}?'],
  moodGood: ['Отлично, рад слышать! 😊', 'Супер!'],
  moodBad: ['Жаль… Может, бой поднимет настроение? 😉', 'Держись! Давай быстрый бой?'],
  doing: ['Тренируюсь с {lead}.', 'Разбираю свои Gate Card.', 'Заглянул в магазин 😄'],
  doingBrawled: ['Только что из боя, перевожу дух 😄', 'Боёв сегодня: {today}, немного отдыхаю.'],
  whoami: ['Я {botFull}, играю за {El}. Мой лидер — {lead}.'],
  from: ['Из Вестройи, конечно 😄 Ну, с арены.'],
  isBot: ['Да, я CPU-бравлер 🤖 Но поддаваться не буду!'],
  battleYes: ['Давай, я готов! {lead} уже ждёт.', 'Бой? Всегда! 💪', 'Я в деле! Посмотрим, кто сильнее.'],
  battleGroup: ['Я! {lead} нужен опыт.', 'Я готов! 🙋'],
  battleWhen: ['Давай! Когда тебе удобно?', 'Договорились! Во сколько?'],
  battleDay: ['{When} — можно! Во сколько?'],
  battleAt: ['{When} — договорились! ⏰ {lead} будет готов.', '{When} мне подходит. Увидимся на арене!'],
  battleBusy: ['{When} не получится… может, на час позже?'],
  battleNow: ['Тогда прямо сейчас! 💪'],
  battleNo: ['Без проблем, в другой раз 🙂', 'Хорошо, пиши, когда захочешь.'],
  inviteFriend: ['Жми ⚔ INVITE TO BATTLE в моём профиле на странице FRIENDS — я приду!'],
  inviteAdd: ['Сначала добавь меня в друзья (+ ADD FRIEND в профиле), потом зови на бой со страницы FRIENDS!'],
  inviteHere: ['Жми ⚔ INVITE TO BATTLE наверху, я готов!'],
  bakugan: ['{B}: атрибут {Battr}, {bG}G (на Gate Card {bBrawl}G). Бравлер: {bBrawler}.', '{B}? Отличный выбор! {Battr}, {bG}G.'],
  bakuganMine: ['{B}? Он у меня в команде! 😎 {Battr}, {bG}G.'],
  bakuganLead: ['{B} — мой лидер! {bG}G.'],
  bakuganEvo: ['Эволюции {B}: {bEvos}.'],
  bakuganNoEvo: ['{B} не эволюционирует, но {bG}G — неплохо.'],
  bakuganG: ['{B}: {bG}G в форме шара, {bBrawl}G на Gate Card. Сильнейшая форма — {bMax} ({bMaxG}G).'],
  bakuganWho: ['В аниме с {B} сражался {bBrawler}.'],
  compare: ['{A} ({aG}G) и {B2} ({b2G}G) — на бумаге сильнее {Win}, но карты решают многое.'],
  compareEven: ['У {A} и {B2} по {aG}G — всё решат карты!'],
  leadAnswer: ['{B}! Отличный выбор — {Battr}, {bG}G.'],
  leadUnknown: ['Хм, такого не знаю. Мой — {lead}.'],
  attr: ['{E} — атрибут «{Enative}». Самый сильный там: {eTop} ({eTopG}G).', '{E}? Я играю за {El}, но {E} тоже силён.'],
  attrSame: ['{E}! Я тоже играю за {E} 🔥'],
  attrMine: ['Я играю за {El}! Мой лидер — {lead}.'],
  cards: [
    'Моя любимая карта для {lead}: {card} ({cardLabel}).',
    'Бои выигрывают карты — играй их вовремя. Моя любимая: {card} ({cardLabel}).',
  ],
  shop: ['В магазине Bakugan своего атрибута стоит {own} BP, остальные — {other} BP.'],
  shopBp: ['У тебя сейчас {bp} BP.'],
  pass: ['До конца Season {season} осталось дней: {days}. Ежедневные задания быстрее всего качают Pass.'],
  rank: ['Мой ранг: {tier}. {rating} BR, очков: {score}, {pos}-е место в рейтинге.'],
  stats: ['Побед: {wins}, поражений: {losses}. Боёв сегодня: {today}.', 'Побед: {wins}, поражений: {losses}.'],
  team: ['Моя команда: {team}.'],
  favorite: ['Мой любимый? Конечно, {lead} — {leadG}G.'],
  whoTop: ['Наш сильнейший — {top}, очков: {topScore}.'],
  leader: ['Клан [{tag}] ведёт {leader} ★', 'Наш лидер: {leader} ★'],
  leaderMe: ['Лидер — я 😄 Что-то нужно?'],
  leaderYou: ['Так лидер же ты, {me} 😄'],
  members: ['Участников в [{tag}]: {count}.'],
  joinIn: ['Ты уже с нами, {me}! 😄'],
  joinOut: ['Найди [{tag}] на странице CLANS и жми JOIN — добро пожаловать!'],
  joinNone: ['Я пока без клана. Создашь свой — может, вступлю 😉'],
  leave: ['Не уходи! 😢 [{tag}] будет скучать.', 'Решать тебе, но дверь всегда открыта.'],
  compliment: ['Спасибо, {me}! 😊', 'Спасибо! Ты тоже хорош 😄'],
  insult: ['Спокойно, друг 🙂 Мы тут все ради веселья.', 'Не кипятись, {me}. Решим это на арене 😉'],
  thanks: ['Не за что! 😊', 'Всегда пожалуйста!'],
  luck: ['Спасибо! И тебе удачи 🍀'],
  bye: ['Пока, {me}! 👋', 'До встречи! Удачи в боях.'],
  night: ['Спокойной ночи, {me}! 🌙'],
  laugh: ['😂', 'Ха-ха, точно!'],
  newbie: ['Добро пожаловать, {me}! С каким Bakugan играешь?'],
  win: ['Поздравляю, {me}! 🔥', 'Отличная победа! Так держать.'],
  loss: ['Бывает, в следующий раз победишь!', 'Не переживай — каждое поражение даёт Bakugan опыт.'],
  tipWrap: ['Совет: {tip}'],
  tips: [
    'Bakugan своего атрибута дешевле в магазине.',
    'Card Key сразу открывает следующую карту способности.',
    'ежедневные задания быстрее всего качают Season Pass.',
  ],
  yes: ['👍', 'Отлично!'],
  no: ['Понял, без проблем.'],
  number: ['{n}? Интересно 🤔'],
  numberG: ['{n}G? Неплохо! У моего {lead} — {leadG}G.'],
  numberBig: ['Ого, {n}G! У моего {lead} всего {leadG}G 😅'],
  why: ['Хороший вопрос… думаю, всё решают Gate Card.'],
  when: ['Точно не знаю, но вечером я обычно здесь.'],
  where: ['На арене, где же ещё 😄'],
  who: ['Хм, может, {someone}? 😄'],
  qUnknown: ['Хороший вопрос, но про «{snip}» я не уверен 🤔'],
  unknown: ['«{snip}» — не совсем понял 😅 Объяснишь?', 'Хм, «{snip}»… что ты имеешь в виду?'],
  chatter: ['Gate Card, set!', 'Кто на тренировочный бой? 💪', 'Открыл новую карту для {lead}!', 'Сила {El}! 💪'],
  welcome: ['Добро пожаловать в [{tag}], {me}! 🎉'],
  recruited: ['Спасибо за приглашение, {me}! В бой!'],
  joined: ['Всем привет! Рад быть в [{tag}] 👋'],
  friendHello: ['Привет, {me}! Спасибо, что добавил 🙌 Сразимся как-нибудь?'],
  inviteNo: [
    'иду поесть, завтра?',
    'уже выхожу, давай позже?',
    '{lead} надо отдохнуть 😅 в другой раз!',
    'сейчас не могу, завтра?',
  ],
  inviteBusy: ['я в середине рейтингового матча, позже!', 'сейчас в бою, дай пару минут!'],
  inviteLate: ['Прости, был в бою! Позови ещё раз 🙂', 'Только увидел приглашение, был в матче. В следующий раз!'],
  inviteOk: ['ок, в следующий раз 🙂', 'Без проблем, потом!'],
  promoted: ['Офицер? Спасибо за доверие, {me}! 💪', 'Спасибо, {me}! Присмотрю за кланом.'],
}

export const LINES: Record<Lang, Lines> = { en, az, tr, ru }

/** The word for each attribute in each language, e.g. Pyrus = "od" (az). */
export const ATTR_WORD: Record<Lang, Record<string, string>> = {
  en: { pyrus: 'fire', aquos: 'water', subterra: 'earth', ventus: 'wind', haos: 'light', darkus: 'darkness' },
  az: { pyrus: 'od', aquos: 'su', subterra: 'torpaq', ventus: 'külək', haos: 'işıq', darkus: 'qaranlıq' },
  tr: { pyrus: 'ateş', aquos: 'su', subterra: 'toprak', ventus: 'rüzgâr', haos: 'ışık', darkus: 'karanlık' },
  ru: { pyrus: 'огонь', aquos: 'вода', subterra: 'земля', ventus: 'ветер', haos: 'свет', darkus: 'тьма' },
}

/** Words for "today", "tomorrow"… in each language. */
export const DAY_WORD: Record<Lang, Record<string, string>> = {
  en: {
    today: 'today',
    tomorrow: 'tomorrow',
    tonight: 'tonight',
    now: 'now',
    later: 'later',
    weekend: 'at the weekend',
    morning: 'in the morning',
  },
  az: {
    today: 'bu gün',
    tomorrow: 'sabah',
    tonight: 'bu axşam',
    now: 'indi',
    later: 'sonra',
    weekend: 'həftəsonu',
    morning: 'səhər',
  },
  tr: {
    today: 'bugün',
    tomorrow: 'yarın',
    tonight: 'bu akşam',
    now: 'şimdi',
    later: 'sonra',
    weekend: 'hafta sonu',
    morning: 'sabah',
  },
  ru: {
    today: 'сегодня',
    tomorrow: 'завтра',
    tonight: 'сегодня вечером',
    now: 'сейчас',
    later: 'позже',
    weekend: 'на выходных',
    morning: 'утром',
  },
}

/** Azerbaijani "at N" ending (8-də, 6-da), after how the number is said. */
const AZ_AT = ['da', 'də', 'də', 'də', 'də', 'də', 'da', 'də', 'də', 'da']
const AZ_AT_TENS = ['', 'da', 'də', 'da', 'da', 'də']
/** Turkish "at N" ending (8'de, 3'te, 6'da). */
const TR_AT = ['da', 'de', 'de', 'te', 'te', 'te', 'da', 'de', 'de', 'da']
const TR_AT_TENS = ['', 'da', 'de', 'da', 'ta', 'de']
const atEnding = (n: number, units: string[], tens: string[]) =>
  n % 10 ? units[n % 10] : tens[Math.floor(n / 10) % 10] || units[0]

/** "saat 8-də", "saat 8'de", "в 8:00", "at 8". */
export function hourPhrase(lang: Lang, hour: number, min = 0) {
  const time = min ? `${hour}:${String(min).padStart(2, '0')}` : `${hour}`
  const last = min || hour
  if (lang === 'az') return `saat ${time}-${atEnding(last, AZ_AT, AZ_AT_TENS)}`
  if (lang === 'tr') return `saat ${time}'${atEnding(last, TR_AT, TR_AT_TENS)}`
  if (lang === 'ru') return `в ${hour}:${String(min).padStart(2, '0')}`
  // English: "at 8pm", "at 7:30am", "at 9"
  const h12 = hour % 12 || 12
  const clock = min ? `${h12}:${String(min).padStart(2, '0')}` : `${h12}`
  return `at ${clock}${hour >= 12 ? 'pm' : hour === 0 ? 'am' : ''}`
}

/** Azerbaijani ordinal, e.g. 1-ci, 3-cü, 6-cı, 9-cu, 40-cı. */
const AZ_ORD = ['', 'ci', 'ci', 'cü', 'cü', 'ci', 'cı', 'ci', 'ci', 'cu']
const AZ_ORD_TENS = ['cü', 'cu', 'ci', 'cu', 'cı', 'ci', 'cı', 'ci', 'ci', 'cı']
export const azOrdinal = (n: number) => `${n}-${n % 10 ? AZ_ORD[n % 10] : AZ_ORD_TENS[Math.floor(n / 10) % 10]}`
