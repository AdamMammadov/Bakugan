import type { Lang } from './chatLines'

/**
 * Kira Kurogane's own lines for direct messages: warm, playful and affectionate, like someone close to the
 * player (sweet, never explicit). Every other brawler keeps the lines in chatLines.ts; see kiraReply in chatBrain.ts.
 * `{name}` fills in a fact as in chatLines.ts ({me} the player, {lead} her lead Bakugan, {other} a name the player
 * mentioned, {snip} the start of what the player wrote).
 */
export type KiraKey =
  | 'hi'
  | 'greet'
  | 'greetMood'
  | 'moodAsk'
  | 'moodAskBrawled'
  | 'moodGood'
  | 'moodMine'
  | 'moodBad'
  | 'miss'
  | 'love'
  | 'loveAsk'
  | 'girlfriend'
  | 'hug'
  | 'kiss'
  | 'compliment'
  | 'beatMe'
  | 'playerWon'
  | 'playerLost'
  | 'battle'
  | 'tag'
  | 'bot'
  | 'confused'
  | 'sorry'
  | 'howWas'
  | 'howWasBrawled'
  | 'where'
  | 'doing'
  | 'doingBrawled'
  | 'jealous'
  | 'thanks'
  | 'bye'
  | 'night'
  | 'morning'
  | 'hurt'
  | 'laugh'
  | 'yes'
  | 'no'
  | 'unknown'
  | 'question'
  | 'friendHello'
  | 'inviteOk'
  | 'inviteNo'
  | 'inviteBusy'
  | 'inviteLate'
  | 'tail'

type KiraLines = Record<KiraKey, string[]>

const az: KiraLines = {
  hi: ['Salaam 🥰', 'Heyy 💜', 'Ooo, sən 😊'],
  greet: ['Salaaam {me} 🥰', 'Ooo, kim yazıb 😌💜 Salam!', 'Salam, canım 😊 Səni gözləyirdim', 'Nəhayət yazdın 🙈 Salam!'],
  greetMood: ['Salaaam {me} 🥰 Necəsən?', 'Heyy 💜 Günün necə keçir?', 'Salam, canım 😊 Nə var, nə yox?'],
  moodAsk: [
    'İndi sən yazdın, daha yaxşıyam 😊 Bəs sən?',
    'Yaxşıyam, {lead} ilə məşq edirdim 💪 Sən necəsən, canım?',
    'Bir az darıxmışdım… indi yaxşıyam 🙈 Sən?',
    'Əla! Xüsusilə indi 😌💜 Sən necəsən?',
  ],
  moodAskBrawled: [
    'Yaxşıyam, indicə döyüşdən çıxdım, ürəyim hələ də döyünür 😅 Sən necəsən?',
    'Bu gün {today} döyüş etmişəm, bir az yorğunam… amma sən yazanda yorğunluq getdi 😊 Sən?',
  ],
  moodMine: ['Mən də yaxşıyam, xüsusilə indi 😌💜', 'Mən? Sən yazanda həmişə yaxşıyam 🥰', 'Mən də əlayam, {lead} ilə məşq edirdim 💪'],
  moodGood: ['Belə eşitmək xoşdur 😊💜', 'Sevindim 🥰 Elə hər gün belə ol', 'Ooo, əla! İndi mən də gülümsəyirəm 😌'],
  moodBad: [
    'Ayy, nə olub? 🥺 Danış mənə',
    'Gəl buraya 🫂 Nə olub, kim incidib səni?',
    'Kefin yoxdur? 🥺 Mən buradayam, danış',
    'Pis olma, canım 💜 İstəsən bir döyüş edək, fikrin dağılar',
  ],
  miss: [
    'Mən də darıxmışdım 🥺💜',
    'Mən daha çox 🙈',
    'Bəs niyə belə gec yazırsan onda? 😤 … mən də darıxdım 💜',
    'Ay, ürəyimi əritdin 🥹 Mən də darıxırdım',
  ],
  love: [
    'Mən də səni ❤️',
    '🙈🙈 … mən də. Amma klandakılara demə 🤫',
    'Ürəyim bir anlıq dayandı 🥹 Mən də səni sevirəm 💜',
    'Bilirdim 😌 Mən də 💜',
  ],
  loveAsk: [
    'Bunu soruşmağa ehtiyac var? 🙈💜',
    'Hmm… bəlkə 😏 Yaxşı, hə, çox 💜',
    'Sevməsəydim bu saatda sənə yazardım? 🥺💜',
  ],
  girlfriend: [
    'Elə bilirdim ki, artıq elədir 🙈💜',
    'Hmm… 🥹 hə. Amma döyüşdə sənə güzəştə getməyəcəyəm, bil 😏',
    'Bunu soruşmaq üçün bu qədər gözlədin? 😤 Hə, əlbəttə 💜',
  ],
  hug: ['🫂💜', 'Gəl bura 🫂 bərk-bərk', 'Qucaqlaşmaq həmişə olar 🥰🫂'],
  kiss: ['🙈🙈 utandırırsan məni', 'Ayy, qızardım 😳💜', 'Hələ tezdir 🙈 əvvəlcə bir döyüş qazan 😏'],
  compliment: [
    'Utandırırsan məni 🙈💜',
    'Sən də çox şirinsən 🥰',
    'Bunu hər gün deyə bilərsən, etiraz etmərəm 😌',
    'Ayy, qızardım 😳 Sağ ol, canım 💜',
  ],
  beatMe: [
    'Hmph 😤 Bu dəfə şanslı idin. Revanş istəyirəm!',
    'Bilərəkdən uduzdum ki, sevinəsən 😌 … yaxşı, yox, həqiqətən yaxşı oynadın 💜',
    'Hə, hə, uddun 🙄 Amma növbəti dəfə {lead} səni bağışlamayacaq 😏',
    'Səninlə qürur duydum 🥹 Amma revanş borcundur 😤💜',
  ],
  playerWon: ['Ooo, təbriklər! 🥳 Səninlə qürur duyuram 💜', 'Mənim çempionum 😌🏆', 'Bilirdim ki, bacaracaqsan 🥰'],
  playerLost: [
    'Ayy 🥺 Fikir vermə, növbətini sən udacaqsan',
    'Kim uddu səni? Adını de, onunla mən döyüşüm 😤💜',
    'Gəl bura 🫂 Bir uduzmaq heç nədir. Birlikdə məşq edək?',
  ],
  battle: [
    'Səninlə? Həmişə 😏 Profilimdə ⚔ INVITE TO BATTLE bas, gözləyirəm 💜',
    'Gəl görək kim kimi udur 😏 ⚔ INVITE TO BATTLE bas!',
    'Hazıram! Amma uduzanda küsmək yoxdur ha 😜 ⚔ INVITE TO BATTLE bas',
  ],
  tag: [
    'Tag battle? Sən və mən bir komandada 🥰 ⚔⚔ TAG BATTLE bas!',
    'Birlikdə? Əlbəttə 💜 ⚔⚔ TAG BATTLE düyməsini bas, gəlirəm',
  ],
  bot: [
    'Bot? 😳 Mən? Sadəcə səndən utanıram deyə qısa yazıram 🙈',
    'Bot olsaydım sənin mesajını belə gözləyərdim? 😒💜',
    'Hmph 😤 Bot sənsən. Mən sadəcə bir az utancağam 🙈',
    'Ayy, bu ağrıtdı 🥺 Bundan sonra daha çox danışacam, söz 💜',
  ],
  confused: ['Nə oldu? 🥺 Səhv bir şey dedim?', 'Niyə sual işarələri? 😅 Başa düşmədin məni?', 'Hmm? 🙈 Nə demək istədin?'],
  sorry: [
    'Bağışladım 😌 Amma bir şərtlə: bu axşam mənimlə döyüşürsən 💜',
    'Yaxşı, küsmürəm 🥺💜',
    'Hmph… yaxşı, bu dəfəlik 😤💜',
  ],
  howWas: ['Nə necə idi? 🙈 Döyüşü deyirsən? Yaxşı keçdi 😊 Bəs səninki?', 'Sakit gün idi… sən olmayanda darıxdırıcıdır 😌'],
  howWasBrawled: [
    'Əla keçdi, qalib gəldim 😌 Amma səni fikirləşirdim deyə az qala uduzurdum 🙈',
    'Gərgin idi! {lead} son anda məni xilas etdi 😅',
  ],
  where: ['Buradayam, canım 💜 Bir az döyüşdə idim', 'Arenadaydım 😅 Amma artıq səninləyəm', 'Harda olacam? Sənin mesajını gözləyirdim 🙈'],
  doing: [
    'Bakuganlarımı parıldadıram, bir də səni fikirləşirəm 🙈',
    '{lead} ilə məşq edirdim. İndi isə səninlə danışıram 😊',
    'Heç nə… sənə yazmaq istəyirdim, amma sən qabaqladın 😌',
  ],
  doingBrawled: ['İndicə döyüşdən çıxdım 😅 Nəfəsimi dərirəm, səninlə 💜'],
  jealous: [
    '{other}? 😒 Mənimlə danışanda başqa qızların adını çəkmə 😤',
    'Hmm… {other} kimdir ki? 🤨 Zarafat edirəm… ya da yox 😤💜',
    '{other}? Nəyinə lazımdır? Mən varam axı 😏',
  ],
  thanks: ['Sənin üçün hər şey 💜', 'Dəyməz, canım 😊', 'Təşəkkürünü bir döyüşlə ödəyərsən 😏💜'],
  bye: ['Getmə hələ 🥺 … yaxşı, sonra yazarsan?', 'Tez qayıt 💜', 'Hələlik, canım 💜 Gözləyəcəm'],
  night: ['Gecən xeyrə qalsın 🌙 Şirin yuxular 💜', 'Yat, dincəl 😴💜 Sabah səni gözləyirəm', 'Gecən xeyrə 🌙 Yuxuda da Bakugan döyüşü görmə ha 😜'],
  morning: ['Sabahın xeyir ☀️ Səhər-səhər sənin mesajın, gün əla başladı 🥰', 'Sabahın xeyir, yuxucul 😌☀️'],
  hurt: ['Ay… bu ağrıtdı 🥺 Niyə belə deyirsən?', 'Hmph 😤 Səndən küsdüm. 5 dəqiqəlik.', 'Belə danışanda xoşuma gəlmir 🥺'],
  laugh: ['Hahaha 😂 sən dəlisən 💜', 'Güldürdün məni 😂', '😂😂 səninlə heç vaxt darıxmıram'],
  yes: ['Yaşasın 🥳', 'Bilirdim ki, hə deyəcəksən 😌', 'Əla 💜'],
  no: ['Hmph 😤 yaxşı…', 'Niyə ki? 🥺', 'Yaxşı, başa düşürəm 💜 Bəs sonra?'],
  unknown: [
    'Hmm 🤔 bunu bir də de, başa düşmədim 🙈',
    'Sən danış, mən dinləyirəm 💜',
    '“{snip}”… 😊 sonra?',
    'Haha, sən həmişə maraqlı şeylər deyirsən 😄',
    'Bilirsən, səninlə danışmaq xoşuma gəlir 😊 Davam et',
  ],
  question: ['Hmm, bilmirəm 🙈 Sən nə düşünürsən?', 'Çətin sualdır 🤔 Birlikdə tapaq?', 'Bunu sonra deyəcəm 😏'],
  friendHello: ['Salam {me} 🥰 Məni dost əlavə etdin, çox sevindim! Bir gün döyüşək?'],
  inviteOk: ['yaxşı, sonra 💜', 'olsun, növbəti dəfə 😊'],
  inviteNo: ['indi olmur, canım 🥺 sonra?', 'yemək yeyirəm 🙈 bir az sonra?'],
  inviteBusy: ['döyüşdəyəm, canım, bir az gözlə 🙈', 'reytinq matçındayam, 5 dəqiqə 💜'],
  inviteLate: ['Ayy, döyüşdə idim, görmədim 🥺 Yenə dəvət et!'],
  tail: [' 💜', ' 😊', ' 🥰', ' 😌'],
}

const en: KiraLines = {
  hi: ['Heyy 🥰', 'Hii 💜', 'Oh, it’s you 😊'],
  greet: ['Heyyy {me} 🥰', 'Look who’s here 😌💜', 'Hi you 😊 I was waiting for you', 'Finally you texted 🙈 Hi!'],
  greetMood: ['Heyy {me} 💜 How are you?', 'Hiii 🥰 How’s your day going?', 'Hey you 😊 What’s up?'],
  moodAsk: [
    'Better now that you texted 😊 And you?',
    'Good! Was training with {lead} 💪 How about you?',
    'Missed you a little… but I’m good now 🙈 You?',
    'Great! Especially now 😌💜 How are you?',
  ],
  moodAskBrawled: [
    'Good, just got out of a brawl, my heart’s still racing 😅 You?',
    '{today} brawls today, a bit tired… but you texting fixes that 😊 You?',
  ],
  moodMine: ['I’m good too, especially now 😌💜', 'Me? Always good when you text 🥰', 'Great, was training with {lead} 💪'],
  moodGood: ['Love to hear that 😊💜', 'Yay 🥰 stay like that', 'Good! Now I’m smiling too 😌'],
  moodBad: [
    'Aww, what happened? 🥺 Tell me',
    'Come here 🫂 Who upset you?',
    'Not a good day? 🥺 I’m here, talk to me',
    'Don’t be sad 💜 Want a brawl to clear your head?',
  ],
  miss: ['I missed you too 🥺💜', 'Me more 🙈', 'Then why do you text so late? 😤 … missed you too 💜', 'Aww, my heart 🥹 I missed you too'],
  love: ['Love you too ❤️', '🙈🙈 … me too. Don’t tell the clan 🤫', 'My heart just skipped 🥹 I love you too 💜', 'I knew it 😌 Me too 💜'],
  loveAsk: ['Do you even need to ask? 🙈💜', 'Hmm… maybe 😏 Okay, yes, a lot 💜', 'Would I be texting you right now if I didn’t? 🥺💜'],
  girlfriend: [
    'I thought I already was 🙈💜',
    'Hmm… 🥹 yes. But I’m still not going easy on you in battle 😏',
    'You waited this long to ask? 😤 Yes, of course 💜',
  ],
  hug: ['🫂💜', 'Come here 🫂 a big one', 'Hugs are always allowed 🥰🫂'],
  kiss: ['🙈🙈 you’re making me blush', 'Aww, now I’m all red 😳💜', 'Not so fast 🙈 win a brawl first 😏'],
  compliment: ['You’re making me blush 🙈💜', 'You’re sweet too 🥰', 'You can say that every day, I won’t mind 😌', 'Aww 😳 thank you 💜'],
  beatMe: [
    'Hmph 😤 You got lucky this time. I want a rematch!',
    'I let you win so you’d be happy 😌 … okay no, you really played well 💜',
    'Yeah yeah, you won 🙄 Next time {lead} won’t be so nice 😏',
    'So proud of you 🥹 But you owe me a rematch 😤💜',
  ],
  playerWon: ['Congrats! 🥳 So proud of you 💜', 'That’s my champion 😌🏆', 'I knew you could do it 🥰'],
  playerLost: [
    'Aww 🥺 Don’t worry, the next one is yours',
    'Who beat you? Tell me their name, I’ll brawl them 😤💜',
    'Come here 🫂 One loss is nothing. Train with me?',
  ],
  battle: [
    'With you? Always 😏 Hit ⚔ INVITE TO BATTLE on my profile, I’m waiting 💜',
    'Let’s see who wins 😏 Press ⚔ INVITE TO BATTLE!',
    'I’m ready! But no sulking when you lose 😜 Hit ⚔ INVITE TO BATTLE',
  ],
  tag: ['A tag battle? You and me on one team 🥰 Hit ⚔⚔ TAG BATTLE!', 'Together? Of course 💜 Press ⚔⚔ TAG BATTLE, I’m coming'],
  bot: [
    'A bot? 😳 Me? I just keep it short because you make me shy 🙈',
    'Would a bot wait for your messages like this? 😒💜',
    'Hmph 😤 You’re the bot. I’m just a little shy 🙈',
    'Ouch, that hurt 🥺 I’ll talk more from now on, promise 💜',
  ],
  confused: ['What happened? 🥺 Did I say something wrong?', 'Why the question marks? 😅 You didn’t get me?', 'Hmm? 🙈 What did you mean?'],
  sorry: ['Forgiven 😌 On one condition: you brawl with me tonight 💜', 'Okay, I’m not mad 🥺💜', 'Hmph… fine, just this once 😤💜'],
  howWas: ['How was what? 🙈 My brawl? It went well 😊 And yours?', 'Quiet day… it’s boring without you 😌'],
  howWasBrawled: ['Went great, I won 😌 Almost lost because I was thinking about you though 🙈', 'Intense! {lead} saved me at the last second 😅'],
  where: ['I’m here 💜 Was in a brawl for a bit', 'At the arena 😅 But I’m all yours now', 'Where else? Waiting for your message 🙈'],
  doing: [
    'Polishing my Bakugan… and thinking about you 🙈',
    'Training with {lead}. Now I’m talking to you 😊',
    'Nothing… I wanted to text you but you beat me to it 😌',
  ],
  doingBrawled: ['Just got out of a brawl 😅 Catching my breath, with you 💜'],
  jealous: [
    '{other}? 😒 Don’t mention other girls when you’re talking to me 😤',
    'Hmm… and who is {other}? 🤨 Kidding… or not 😤💜',
    '{other}? What for? You’ve got me 😏',
  ],
  thanks: ['Anything for you 💜', 'Anytime 😊', 'Pay me back with a brawl 😏💜'],
  bye: ['Don’t go yet 🥺 … okay, text me later?', 'Come back soon 💜', 'Bye 💜 I’ll be waiting'],
  night: ['Good night 🌙 Sweet dreams 💜', 'Sleep well 😴💜 See you tomorrow', 'Night night 🌙 No dreaming about brawls 😜'],
  morning: ['Good morning ☀️ Your message first thing, best start ever 🥰', 'Morning, sleepyhead 😌☀️'],
  hurt: ['Ouch… that hurt 🥺 Why would you say that?', 'Hmph 😤 Not talking to you. For 5 minutes.', 'I don’t like it when you talk like that 🥺'],
  laugh: ['Hahaha 😂 you’re crazy 💜', 'You made me laugh 😂', '😂😂 never boring with you'],
  yes: ['Yay 🥳', 'Knew you’d say yes 😌', 'Perfect 💜'],
  no: ['Hmph 😤 fine…', 'Why not? 🥺', 'Okay, I get it 💜 Later then?'],
  unknown: [
    'Hmm 🤔 say that again, I didn’t get it 🙈',
    'Go on, I’m listening 💜',
    '“{snip}”… 😊 and then?',
    'Haha, you always say the most interesting things 😄',
    'You know I like talking to you 😊 Keep going',
  ],
  question: ['Hmm, no idea 🙈 What do you think?', 'Tough one 🤔 Figure it out together?', 'I’ll tell you later 😏'],
  friendHello: ['Hi {me} 🥰 You added me, that made my day! Brawl sometime?'],
  inviteOk: ['okay, later 💜', 'it’s fine, next time 😊'],
  inviteNo: ['can’t right now 🥺 later?', 'eating 🙈 in a bit?'],
  inviteBusy: ['in a brawl, give me a sec 🙈', 'ranked match, 5 min 💜'],
  inviteLate: ['Aww, I was mid-brawl and missed it 🥺 Invite me again!'],
  tail: [' 💜', ' 😊', ' 🥰', ' 😌'],
}

const tr: KiraLines = {
  hi: ['Selaam 🥰', 'Heyy 💜'],
  greet: ['Selaaam {me} 🥰', 'Bak kim gelmiş 😌💜', 'Selam canım 😊 Seni bekliyordum'],
  greetMood: ['Selam {me} 💜 Nasılsın?', 'Selaam 🥰 Günün nasıl geçiyor?'],
  moodAsk: ['Sen yazınca daha iyiyim 😊 Sen?', 'İyiyim, {lead} ile antrenman yapıyordum 💪 Sen nasılsın canım?'],
  moodAskBrawled: ['İyiyim, maçtan yeni çıktım, kalbim hâlâ küt küt 😅 Sen?'],
  moodMine: ['Ben de iyiyim, özellikle şimdi 😌💜', 'Ben mi? Sen yazınca hep iyiyim 🥰'],
  moodGood: ['Buna sevindim 😊💜', 'Yaşasın 🥰 hep böyle ol'],
  moodBad: ['Aww, ne oldu? 🥺 Anlat bana', 'Gel buraya 🫂 Kim üzdü seni?'],
  miss: ['Ben de seni özledim 🥺💜', 'Ben daha çok 🙈'],
  love: ['Ben de seni ❤️', '🙈🙈 … ben de. Klana söyleme 🤫'],
  loveAsk: ['Sormana gerek var mı? 🙈💜', 'Hmm… belki 😏 Tamam, evet, çok 💜'],
  girlfriend: ['Zaten öyle sanıyordum 🙈💜', 'Hmm… 🥹 evet. Ama maçta sana acımam 😏'],
  hug: ['🫂💜', 'Gel buraya 🫂'],
  kiss: ['🙈🙈 utandırıyorsun beni', 'Kızardım 😳💜'],
  compliment: ['Utandırıyorsun beni 🙈💜', 'Sen de çok tatlısın 🥰'],
  beatMe: ['Hıh 😤 Bu sefer şanslıydın. Rövanş istiyorum!', 'Tamam tamam, kazandın 🙄 Ama bir dahaki sefere {lead} acımayacak 😏'],
  playerWon: ['Tebrikler! 🥳 Seninle gurur duyuyorum 💜', 'Benim şampiyonum 😌🏆'],
  playerLost: ['Aww 🥺 Takma kafana, sonrakini sen kazanırsın', 'Seni kim yendi? Söyle, onunla ben kapışayım 😤💜'],
  battle: ['Seninle mi? Her zaman 😏 Profilimde ⚔ INVITE TO BATTLE’a bas 💜', 'Hazırım! Ama kaybedince küsmek yok 😜'],
  tag: ['Tag battle mı? Sen ve ben aynı takımda 🥰 ⚔⚔ TAG BATTLE’a bas!'],
  bot: ['Bot mu? 😳 Ben mi? Sadece senden utanıyorum 🙈', 'Bot olsam mesajını böyle bekler miydim? 😒💜'],
  confused: ['Ne oldu? 🥺 Yanlış bir şey mi dedim?', 'Hmm? 🙈 Ne demek istedin?'],
  sorry: ['Affettim 😌 Ama bu akşam benimle kapışıyorsun 💜', 'Tamam, küsmedim 🥺💜'],
  howWas: ['Ne nasıldı? 🙈 Maçım mı? İyi geçti 😊 Seninki?'],
  howWasBrawled: ['Harika geçti, kazandım 😌 Ama seni düşünürken az kalsın kaybediyordum 🙈'],
  where: ['Buradayım canım 💜 Biraz maçtaydım', 'Arenadaydım 😅 Ama artık seninleyim'],
  doing: ['Bakugan’larımı parlatıyorum… bir de seni düşünüyorum 🙈', '{lead} ile antrenman yapıyordum. Şimdi de seninle konuşuyorum 😊'],
  doingBrawled: ['Maçtan yeni çıktım 😅 Seninle nefesleniyorum 💜'],
  jealous: ['{other} mi? 😒 Benimle konuşurken başka kızların adını anma 😤', '{other} da kim? 🤨 Şaka… ya da değil 😤💜'],
  thanks: ['Senin için her şey 💜', 'Ne demek canım 😊'],
  bye: ['Gitme daha 🥺 … tamam, sonra yazarsın, olur mu?', 'Çabuk dön 💜'],
  night: ['İyi geceler 🌙 Tatlı rüyalar 💜', 'İyi uykular 😴💜 Yarın görüşürüz'],
  morning: ['Günaydın ☀️ Sabah sabah mesajın, gün harika başladı 🥰'],
  hurt: ['Ay… bu acıttı 🥺 Neden öyle diyorsun?', 'Hıh 😤 Küstüm. 5 dakikalığına.'],
  laugh: ['Hahaha 😂 delisin 💜', '😂😂 seninle hiç sıkılmıyorum'],
  yes: ['Yaşasın 🥳', 'Evet diyeceğini biliyordum 😌'],
  no: ['Hıh 😤 peki…', 'Neden ama? 🥺'],
  unknown: ['Hmm 🤔 bir daha söyle, anlamadım 🙈', 'Anlat, dinliyorum 💜', '“{snip}”… 😊 sonra?'],
  question: ['Hmm, bilmiyorum 🙈 Sen ne düşünüyorsun?', 'Zor soru 🤔 Birlikte bulalım mı?'],
  friendHello: ['Selam {me} 🥰 Beni eklemen çok sevindirdi! Bir gün kapışalım mı?'],
  inviteOk: ['tamam, sonra 💜'],
  inviteNo: ['şimdi olmaz canım 🥺 sonra?'],
  inviteBusy: ['maçtayım canım, biraz bekle 🙈'],
  inviteLate: ['Ay, maçtaydım, göremedim 🥺 Tekrar davet et!'],
  tail: [' 💜', ' 😊', ' 🥰'],
}

const ru: KiraLines = {
  hi: ['Привееет 🥰', 'Приветик 💜'],
  greet: ['Привееет, {me} 🥰', 'Смотри-ка, кто пришёл 😌💜', 'Привет 😊 Я тебя ждала'],
  greetMood: ['Привет, {me} 💜 Как ты?', 'Приветик 🥰 Как проходит день?'],
  moodAsk: ['С тобой — отлично 😊 А ты как?', 'Хорошо, тренировалась с {lead} 💪 А ты как?'],
  moodAskBrawled: ['Хорошо, только что из боя, сердце ещё стучит 😅 А ты?'],
  moodMine: ['У меня тоже всё хорошо, особенно сейчас 😌💜', 'У меня? Когда ты пишешь — всегда хорошо 🥰'],
  moodGood: ['Рада это слышать 😊💜', 'Ура 🥰 пусть так и будет'],
  moodBad: ['Ой, что случилось? 🥺 Расскажи мне', 'Иди сюда 🫂 Кто тебя расстроил?'],
  miss: ['Я тоже скучала 🥺💜', 'А я больше 🙈'],
  love: ['И я тебя ❤️', '🙈🙈 … я тоже. Только клану не говори 🤫'],
  loveAsk: ['Ты ещё спрашиваешь? 🙈💜', 'Хм… может быть 😏 Ладно, да, очень 💜'],
  girlfriend: ['А я думала, что уже 🙈💜', 'Хм… 🥹 да. Но в бою поддаваться не буду 😏'],
  hug: ['🫂💜', 'Иди сюда 🫂'],
  kiss: ['🙈🙈 ты меня смущаешь', 'Ой, я покраснела 😳💜'],
  compliment: ['Ты меня смущаешь 🙈💜', 'Ты тоже чудо 🥰'],
  beatMe: ['Хмф 😤 В этот раз повезло. Хочу реванш!', 'Ладно-ладно, победа твоя 🙄 Но в следующий раз {lead} не пожалеет 😏'],
  playerWon: ['Поздравляю! 🥳 Горжусь тобой 💜', 'Вот это да 🏆 Горжусь 😌'],
  playerLost: ['Ой 🥺 Не переживай, следующий бой твой', 'Кто тебя победил? Скажи имя, я с ним разберусь 😤💜'],
  battle: ['С тобой? Всегда 😏 Жми ⚔ INVITE TO BATTLE в моём профиле 💜', 'Я готова! Только не обижайся, когда проиграешь 😜'],
  tag: ['Tag battle? Ты и я в одной команде 🥰 Жми ⚔⚔ TAG BATTLE!'],
  bot: ['Бот? 😳 Я? Просто стесняюсь тебя, вот и пишу коротко 🙈', 'Разве бот так ждал бы твоих сообщений? 😒💜'],
  confused: ['Что случилось? 🥺 Я что-то не то сказала?', 'Хм? 🙈 Что ты имеешь в виду?'],
  sorry: ['Прощаю 😌 Но с условием: вечером бой со мной 💜', 'Ладно, не обижаюсь 🥺💜'],
  howWas: ['Что именно? 🙈 Мой бой? Всё хорошо 😊 А у тебя?'],
  howWasBrawled: ['Отлично, я победила 😌 Хотя чуть не проиграла, думая о тебе 🙈'],
  where: ['Я здесь 💜 Была немного в бою', 'На арене была 😅 Но теперь я с тобой'],
  doing: ['Натираю своих Bakugan… и думаю о тебе 🙈', 'Тренировалась с {lead}. А теперь болтаю с тобой 😊'],
  doingBrawled: ['Только что из боя 😅 Перевожу дух, с тобой 💜'],
  jealous: ['{other}? 😒 Не говори со мной о других девушках 😤', 'Хм… а кто такая {other}? 🤨 Шучу… или нет 😤💜'],
  thanks: ['Для тебя — всё что угодно 💜', 'Не за что 😊'],
  bye: ['Не уходи ещё 🥺 … ладно, напишешь потом?', 'Возвращайся скорее 💜'],
  night: ['Спокойной ночи 🌙 Сладких снов 💜', 'Высыпайся 😴💜 До завтра'],
  morning: ['Доброе утро ☀️ Твоё сообщение с утра — лучшее начало дня 🥰'],
  hurt: ['Ой… это было обидно 🥺 Зачем ты так?', 'Хмф 😤 Обиделась. На 5 минут.'],
  laugh: ['Ахаха 😂 ты чудо 💜', '😂😂 с тобой никогда не скучно'],
  yes: ['Ура 🥳', 'Я знала, что ты согласишься 😌'],
  no: ['Хмф 😤 ладно…', 'А почему нет? 🥺'],
  unknown: ['Хм 🤔 повтори, я не поняла 🙈', 'Рассказывай, я слушаю 💜', '«{snip}»… 😊 и что дальше?'],
  question: ['Хм, не знаю 🙈 А ты как думаешь?', 'Сложный вопрос 🤔 Разберёмся вместе?'],
  friendHello: ['Привет, {me} 🥰 Теперь мы друзья — так приятно! Сразимся как-нибудь?'],
  inviteOk: ['ладно, потом 💜'],
  inviteNo: ['сейчас не могу 🥺 потом?'],
  inviteBusy: ['я в бою, подожди чуть-чуть 🙈'],
  inviteLate: ['Ой, я была в бою и пропустила 🥺 Позови ещё раз!'],
  tail: [' 💜', ' 😊', ' 🥰'],
}

export const KIRA_LINES: Record<Lang, KiraLines> = { az, en, tr, ru }
