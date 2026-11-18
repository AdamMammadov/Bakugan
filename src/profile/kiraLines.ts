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
  | 'choiceMe'
  | 'choiceYou'
  | 'choice'
  | 'oops'
  | 'answerYes'
  | 'answerNo'
  | 'why'
  | 'favColor'
  | 'favFood'
  | 'favMusic'
  | 'favMovie'
  | 'age'
  | 'likeAsk'
  | 'awake'
  | 'answered'
  | 'day'
  | 'dayHeard'
  | 'dayGood'
  | 'dayBad'
  | 'what'
  | 'ack'
  | 'okYes'
  | 'okNo'
  | 'topic'
  | 'listen'
  | 'pTired'
  | 'pWork'
  | 'pSchool'
  | 'pEat'
  | 'pHome'
  | 'pPlay'

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
    'Haha, sən həmişə maraqlı şeylər deyirsən 😄',
    'Bilirsən, səninlə danışmaq xoşuma gəlir 😊 Davam et',
  ],
  question: ['Hmm, bilmirəm 🙈 Sən nə düşünürsən?', 'Çətin sualdır 🤔 Birlikdə tapaq?', 'Bunu sonra deyəcəm 😏'],
  friendHello: ['Salam {me} 🥰 Məni dost əlavə etdin, çox sevindim! Bir gün döyüşək?'],
  inviteOk: ['yaxşı, sonra 💜', 'olsun, növbəti dəfə 😊'],
  inviteNo: ['indi olmur, canım 🥺 sonra?', 'yemək yeyirəm 🙈 bir az sonra?'],
  inviteBusy: ['döyüşdəyəm, canım, bir az gözlə 🙈', 'reytinq matçındayam, 5 dəqiqə 💜'],
  inviteLate: ['Ayy, döyüşdə idim, görmədim 🥺 Yenə dəvət et!'],
  choiceMe: ['Mən, əlbəttə 😏 {rival} kimdir ki?', 'Əlbəttə mən 😌💜 Başqa cavab ola bilməz', 'Bu nə sualdır? 😤 Mən! {rival} heç yaxınıma da gəlməz 😏'],
  choiceYou: ['Sən, əlbəttə 🥰', 'Fikirləşmədən: sən 💜', 'Sən! Bunu niyə soruşursan ki? 🙈'],
  choice: ['{pick} 😌 Fikirləşmədən', 'Məncə {pick} 🤔💜', '{pick}! Bəs sən nə deyirsən?'],
  oops: ['Bağışla 🙈 fikrim səndə idi.', 'Ayy, düz deyirsən, cavab vermədim 😅', 'Hə, bağışla 🙈'],
  answerYes: ['Hə 😌', 'Əlbəttə 💜', 'Hə, hə 🙈'],
  awake: ['Yox, səni gözləyirdim 🙈', 'Yatmamışam hələ 😌 sənə gecən xeyrə demədən yuxum gəlmir'],
  answered: ['Cavab verdim axı 🙈 “{said}”', 'Dedim ki 😤 “{said}”'],
  answerNo: ['Yox 🙈', 'Hmm, yox 😅', 'Elə də yox 😌'],
  why: ['Çünki belə xoşuma gəlir 😌', 'Çünki sənsən 🙈💜', 'Hmm… səbəbi sirdir 🤫', 'Bilmirəm, ürəyim belə deyir 💜'],
  favColor: ['Bənövşəyi, əlbəttə 💜 Darkus qızıyam axı', 'Bənövşəyi və qara 🖤💜'],
  favFood: ['Şokolad 🍫 bir də pizza 🍕', 'Şirin nə varsa 🍰 sən nəyi sevirsən?'],
  favMusic: ['Gecə dinlənən sakit mahnılar 🎧', 'Döyüşdən əvvəl sürətli mahnılar, gecə isə sakit olanlar 🎧💜'],
  favMovie: ['Anime 😄 xüsusilə döyüş olanları', 'Romantik filmlər… amma heç kimə demə 🙈'],
  age: ['Qızdan yaş soruşmazlar 😤🙈', 'Sirdir 🤫 amma döyüşdə təcrübəm çoxdur 😏'],
  likeAsk: ['Bəyənməsəydim burada səninlə danışardım? 🙈💜', 'Hmm… bir az 😏 yaxşı, çox 💜'],
  day: [
    'Yaxşı keçir 😊 Səhər {lead} ilə məşq etdim, indi də səninləyəm. Bəs sənin günün necə keçir?',
    'Bir az yorucu idi, iki döyüşüm oldu 😅 Amma indi yaxşıdır. Sənin günün necədir?',
    'Sakit… sən yazana qədər darıxdırıcı idi 😌 Bəs sənin?',
  ],
  dayHeard: ['Hmm, başa düşdüm 😊 Əsas odur ki, indi buradasan 💜', 'Belə günlər də olur 😌 Danış, başqa nə oldu?', 'Aha 😊 Yaxşı ki yazdın, səni gözləyirdim'],
  dayGood: ['Sevindim 🥰 Elə hər günün belə keçsin', 'Əla! Gülümsəyirsən yəqin indi 😌💜'],
  dayBad: ['Ayy 🥺 nə olub ki? Danış mənə', 'Gəl bura 🫂 Pis gün keçər, mən buradayam 💜'],
  what: ['Heç nə 🙈 sadəcə səni fikirləşirdim', 'Nə “nə”? 😄 Səninlə danışıram da', 'Hmm? 😊 Bir şey demək istəyirdin?'],
  ack: ['Nə fikirləşirsən? 🤔', 'Söhbətimiz yaman qısaldı ha 😅', 'Səssizləşdin 🙈 hər şey yaxşıdır?'],
  okYes: ['Yaxşı 😊', 'Oldu 💜', 'Super 😌'],
  okNo: ['Yaxşı, problem deyil 😊', 'Olsun 💜', 'Aydındır 😌'],
  topic: [
    'Bəs sən bu gün nə etdin? 😊',
    'Bilirsən bu gün mağazada nə gördüm? Yeni bir skin, çox qəşəngdir 😍 Sən skin alırsan?',
    'Səncə {lead} təkamüldən sonra daha güclü olacaq? 🤔',
    'Sabah boşsan? Bir döyüş edərik 😏',
    'Ən çox hansı Bakuganını sevirsən? 😊',
    'İndi musiqi dinləyirsən? Mən Dostlar səhifəsindəki mahnını çox sevirəm 🎧',
    'Bu gün klanda çox səs-küy var idi 😅 Sənin klanın necədir?',
  ],
  listen: ['Hmm, başa düşürəm 😊', 'Ciddi? 😮 Sonra nə oldu?', 'Vay 😮 danış, maraqlıdır', 'Səni dinləmək xoşdur 💜 davam et'],
  pTired: ['Yorulmusan? 🥺 Bir az dincəl, mən buradayam', 'Gəl bura 🫂 bu gün çox çalışmısan yəqin', 'Onda bu gün döyüş yoxdur, sadəcə söhbət edək 😌💜'],
  pWork: ['İşdən sonra yorulmusan yəqin 🥺 Necə keçdi işdə?', 'Çalışqansan 😌 Fasilədə mənə yazmağın xoşuma gəldi 💜'],
  pSchool: ['Dərslər necədir? 📚 Çətin deyil ki?', 'Oxu, oxu 😌 sonra döyüşərik. Uğurlar 💜'],
  pEat: ['Nuş olsun 😋 Nə yeyirsən?', 'Afiyət olsun 😊 mənə də saxla 🙈'],
  pHome: ['Evdə olmaq yaxşıdır 😌 Rahatlayırsan?', 'Mən də evdəyəm 😊 Onda bir az söhbət edək'],
  pPlay: ['Nə oynayırsan? 😏 Məndən başqasıyla döyüşmürsən ki? 😤', 'Uğurlar 💪 Sonra danışarsan necə keçdi'],
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
    'Haha, you always say the most interesting things 😄',
    'You know I like talking to you 😊 Keep going',
  ],
  question: ['Hmm, no idea 🙈 What do you think?', 'Tough one 🤔 Figure it out together?', 'I’ll tell you later 😏'],
  friendHello: ['Hi {me} 🥰 You added me, that made my day! Brawl sometime?'],
  inviteOk: ['okay, later 💜', 'it’s fine, next time 😊'],
  inviteNo: ['can’t right now 🥺 later?', 'eating 🙈 in a bit?'],
  inviteBusy: ['in a brawl, give me a sec 🙈', 'ranked match, 5 min 💜'],
  inviteLate: ['Aww, I was mid-brawl and missed it 🥺 Invite me again!'],
  choiceMe: ['Me, obviously 😏 Who even is {rival}?', 'Me, of course 😌💜 There’s no other answer', 'What kind of question is that? 😤 Me! {rival} doesn’t even come close 😏'],
  choiceYou: ['You, of course 🥰', 'No need to think: you 💜', 'You! Why would you even ask? 🙈'],
  choice: ['{pick} 😌 Easy', 'I’d say {pick} 🤔💜', '{pick}! What about you?'],
  oops: ['Sorry 🙈 I was thinking about you.', 'Aww, you’re right, I didn’t answer 😅', 'Oops, sorry 🙈'],
  answerYes: ['Yes 😌', 'Of course 💜', 'Yes, yes 🙈'],
  awake: ['No, I was waiting for you 🙈', 'Not yet 😌 can’t sleep before saying good night to you'],
  answered: ['I did answer 🙈 “{said}”', 'I told you 😤 “{said}”'],
  answerNo: ['No 🙈', 'Hmm, no 😅', 'Not really 😌'],
  why: ['Because I like it that way 😌', 'Because it’s you 🙈💜', 'Hmm… that’s a secret 🤫', 'I don’t know, my heart says so 💜'],
  favColor: ['Purple, of course 💜 I’m a Darkus girl', 'Purple and black 🖤💜'],
  favFood: ['Chocolate 🍫 and pizza 🍕', 'Anything sweet 🍰 what about you?'],
  favMusic: ['Quiet songs late at night 🎧', 'Fast songs before a brawl, quiet ones at night 🎧💜'],
  favMovie: ['Anime 😄 especially the battle ones', 'Romance movies… don’t tell anyone 🙈'],
  age: ['You don’t ask a girl her age 😤🙈', 'It’s a secret 🤫 but I’ve got plenty of brawling experience 😏'],
  likeAsk: ['Would I be here talking to you if I didn’t? 🙈💜', 'Hmm… a little 😏 okay, a lot 💜'],
  day: [
    'It’s going well 😊 Trained with {lead} this morning, and now I’m with you. How’s your day?',
    'A bit tiring, I had two brawls 😅 But it’s good now. How’s yours going?',
    'Quiet… boring until you texted 😌 And yours?',
  ],
  dayHeard: ['Mm, I see 😊 What matters is you’re here now 💜', 'Days like that happen 😌 What else happened?', 'Aha 😊 Glad you texted, I was waiting'],
  dayGood: ['Yay 🥰 May every day go like that', 'Great! You’re smiling now, I can tell 😌💜'],
  dayBad: ['Aww 🥺 what happened? Tell me', 'Come here 🫂 Bad days pass, I’m here 💜'],
  what: ['Nothing 🙈 I was just thinking about you', 'What “what”? 😄 I’m talking to you', 'Hm? 😊 Were you going to say something?'],
  ack: ['What are you thinking about? 🤔', 'Our chat got so short 😅', 'You went quiet 🙈 everything okay?'],
  okYes: ['Okay 😊', 'Done 💜', 'Great 😌'],
  okNo: ['Okay, no problem 😊', 'That’s fine 💜', 'Got it 😌'],
  topic: [
    'So what did you do today? 😊',
    'Guess what I saw in the shop today? A new skin, so pretty 😍 Do you buy skins?',
    'Do you think {lead} will be even stronger after evolving? 🤔',
    'Are you free tomorrow? We could brawl 😏',
    'Which of your Bakugan do you like most? 😊',
    'Are you listening to music right now? I love the song on the Friends page 🎧',
    'The clan was so noisy today 😅 How’s your clan?',
  ],
  listen: ['Mm, I get it 😊', 'Really? 😮 Then what?', 'Whoa 😮 tell me more', 'I like listening to you 💜 go on'],
  pTired: ['Tired? 🥺 Rest a little, I’m here', 'Come here 🫂 you worked hard today', 'Then no brawls today, let’s just talk 😌💜'],
  pWork: ['You must be tired after work 🥺 How did it go?', 'Hard worker 😌 I like that you text me on your break 💜'],
  pSchool: ['How are classes? 📚 Not too hard?', 'Study first 😌 we’ll brawl later. Good luck 💜'],
  pEat: ['Enjoy 😋 What are you eating?', 'Bon appétit 😊 save me some 🙈'],
  pHome: ['Home is nice 😌 Relaxing?', 'I’m home too 😊 Let’s chat a bit then'],
  pPlay: ['What are you playing? 😏 Not brawling anyone but me, right? 😤', 'Good luck 💪 Tell me how it went after'],
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
  unknown: ['Hmm 🤔 bir daha söyle, anlamadım 🙈', 'Anlat, dinliyorum 💜'],
  question: ['Hmm, bilmiyorum 🙈 Sen ne düşünüyorsun?', 'Zor soru 🤔 Birlikte bulalım mı?'],
  friendHello: ['Selam {me} 🥰 Beni eklemen çok sevindirdi! Bir gün kapışalım mı?'],
  inviteOk: ['tamam, sonra 💜'],
  inviteNo: ['şimdi olmaz canım 🥺 sonra?'],
  inviteBusy: ['maçtayım canım, biraz bekle 🙈'],
  inviteLate: ['Ay, maçtaydım, göremedim 🥺 Tekrar davet et!'],
  choiceMe: ['Ben tabii ki 😏 {rival} da kim?', 'Tabii ki ben 😌💜 Başka cevap olamaz'],
  choiceYou: ['Sen tabii ki 🥰', 'Hiç düşünmeden: sen 💜'],
  choice: ['{pick} 😌 Düşünmeden', 'Bence {pick} 🤔💜'],
  oops: ['Pardon 🙈 aklım sendeydi.', 'Haklısın, cevap vermedim 😅'],
  answerYes: ['Evet 😌', 'Tabii ki 💜'],
  awake: ['Hayır, seni bekliyordum 🙈'],
  answered: ['Cevap verdim ya 🙈 “{said}”'],
  answerNo: ['Hayır 🙈', 'Hmm, yok 😅'],
  why: ['Çünkü böyle hoşuma gidiyor 😌', 'Çünkü sensin 🙈💜', 'Hmm… sır 🤫'],
  favColor: ['Mor tabii ki 💜 Darkus kızıyım'],
  favFood: ['Çikolata 🍫 bir de pizza 🍕'],
  favMusic: ['Gece dinlenen sakin şarkılar 🎧'],
  favMovie: ['Anime 😄 özellikle savaşlı olanlar'],
  age: ['Bir kıza yaşı sorulmaz 😤🙈'],
  likeAsk: ['Beğenmesem burada seninle konuşur muydum? 🙈💜'],
  day: ['İyi geçiyor 😊 Sabah {lead} ile antrenman yaptım, şimdi de seninleyim. Senin günün nasıl?', 'Biraz yorucuydu, iki maçım oldu 😅 Ama şimdi iyi. Seninki nasıl?'],
  dayHeard: ['Hmm, anladım 😊 Önemli olan şimdi burada olman 💜', 'Böyle günler de olur 😌 Başka ne oldu?'],
  dayGood: ['Sevindim 🥰 Her günün böyle geçsin'],
  dayBad: ['Aww 🥺 ne oldu? Anlat bana', 'Gel buraya 🫂 Kötü günler geçer, ben buradayım 💜'],
  what: ['Hiç 🙈 sadece seni düşünüyordum', 'Ne “ne”? 😄 Seninle konuşuyorum işte'],
  ack: ['Ne düşünüyorsun? 🤔', 'Sessizleştin 🙈 her şey yolunda mı?'],
  okYes: ['Tamam 😊', 'Süper 😌'],
  okNo: ['Tamam, sorun değil 😊', 'Olsun 💜'],
  topic: ['Peki sen bugün ne yaptın? 😊', 'Yarın boş musun? Bir maç yaparız 😏', 'En çok hangi Bakugan’ını seviyorsun? 😊', 'Şu an müzik dinliyor musun? Ben Friends sayfasındaki şarkıya bayılıyorum 🎧'],
  listen: ['Hmm, anlıyorum 😊', 'Ciddi mi? 😮 Sonra ne oldu?', 'Seni dinlemek hoşuma gidiyor 💜 devam et'],
  pTired: ['Yoruldun mu? 🥺 Biraz dinlen, ben buradayım', 'Bugün maç yok, sadece sohbet edelim 😌💜'],
  pWork: ['İşten sonra yorulmuşsundur 🥺 Nasıl geçti?'],
  pSchool: ['Dersler nasıl? 📚 Zor değil ya?'],
  pEat: ['Afiyet olsun 😋 Ne yiyorsun?'],
  pHome: ['Evde olmak güzel 😌 Dinleniyor musun?'],
  pPlay: ['Ne oynuyorsun? 😏 Benden başkasıyla kapışmıyorsun değil mi? 😤'],
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
  unknown: ['Хм 🤔 повтори, я не поняла 🙈', 'Рассказывай, я слушаю 💜'],
  question: ['Хм, не знаю 🙈 А ты как думаешь?', 'Сложный вопрос 🤔 Разберёмся вместе?'],
  friendHello: ['Привет, {me} 🥰 Теперь мы друзья — так приятно! Сразимся как-нибудь?'],
  inviteOk: ['ладно, потом 💜'],
  inviteNo: ['сейчас не могу 🥺 потом?'],
  inviteBusy: ['я в бою, подожди чуть-чуть 🙈'],
  inviteLate: ['Ой, я была в бою и пропустила 🥺 Позови ещё раз!'],
  choiceMe: ['Я, конечно 😏 А кто такая {rival}?', 'Конечно я 😌💜 Других ответов нет'],
  choiceYou: ['Ты, конечно 🥰', 'Даже думать не надо: ты 💜'],
  choice: ['{pick} 😌 Без вариантов', 'Думаю, {pick} 🤔💜'],
  oops: ['Прости 🙈 я задумалась о тебе.', 'Ой, и правда, я не ответила 😅'],
  answerYes: ['Да 😌', 'Конечно 💜'],
  awake: ['Нет, я ждала тебя 🙈'],
  answered: ['Я же ответила 🙈 «{said}»'],
  answerNo: ['Нет 🙈', 'Хм, нет 😅'],
  why: ['Потому что мне так нравится 😌', 'Потому что это ты 🙈💜', 'Хм… это секрет 🤫'],
  favColor: ['Фиолетовый, конечно 💜 Я же Darkus'],
  favFood: ['Шоколад 🍫 и пицца 🍕'],
  favMusic: ['Спокойные песни поздно ночью 🎧'],
  favMovie: ['Аниме 😄 особенно про битвы'],
  age: ['У девушки возраст не спрашивают 😤🙈'],
  likeAsk: ['Разве я бы тут с тобой болтала, если бы нет? 🙈💜'],
  day: ['Хорошо 😊 Утром тренировалась с {lead}, а теперь с тобой. А как твой день?', 'Немного утомительно, было два боя 😅 Но сейчас хорошо. Как твой день?'],
  dayHeard: ['Понятно 😊 Главное, что ты сейчас здесь 💜', 'Бывают и такие дни 😌 Что ещё было?'],
  dayGood: ['Ура 🥰 Пусть каждый день будет таким'],
  dayBad: ['Ой 🥺 что случилось? Расскажи мне', 'Иди сюда 🫂 Плохие дни проходят, я рядом 💜'],
  what: ['Ничего 🙈 просто думала о тебе', 'Что «что»? 😄 Я с тобой разговариваю'],
  ack: ['О чём думаешь? 🤔', 'Всё в порядке? 🙈'],
  okYes: ['Хорошо 😊', 'Отлично 😌'],
  okNo: ['Ладно, без проблем 😊', 'Ничего страшного 💜'],
  topic: ['Чем сегодня занимаешься? 😊', 'Завтра есть время? Можем сразиться 😏', 'Какой из твоих Bakugan тебе нравится больше всего? 😊', 'Ты сейчас слушаешь музыку? Мне очень нравится песня на странице Friends 🎧'],
  listen: ['Понимаю 😊', 'Серьёзно? 😮 А дальше что?', 'Мне нравится тебя слушать 💜 продолжай'],
  pTired: ['Устаёшь? 🥺 Отдохни немного, я рядом', 'Тогда сегодня без боёв, просто поболтаем 😌💜'],
  pWork: ['После работы, наверное, сил нет 🥺 Как прошло?'],
  pSchool: ['Как учёба? 📚 Не слишком сложно?'],
  pEat: ['Приятного аппетита 😋 Что ешь?'],
  pHome: ['Дома хорошо 😌 Отдыхаешь?'],
  pPlay: ['Во что играешь? 😏 Надеюсь, ни с кем, кроме меня, не сражаешься? 😤'],
  tail: [' 💜', ' 😊', ' 🥰'],
}

export const KIRA_LINES: Record<Lang, KiraLines> = { az, en, tr, ru }
