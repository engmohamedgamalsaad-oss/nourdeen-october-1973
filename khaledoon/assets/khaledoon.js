/* خالدون عبر التاريخ — shared script: reveal, progress bar, languages (AR/EN/FR/IT; DE via shared German dictionary), theme, background */
(function(){
document.documentElement.classList.add('ready');var tg=document.querySelectorAll(".reveal");
if("IntersectionObserver" in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
 var ob=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");ob.unobserve(e.target)}})},{threshold:.1});
 tg.forEach(function(el){ob.observe(el)});
}else tg.forEach(function(el){el.classList.add("in")});
})();
(function(){var P=document.getElementById('prog');function sc(){var m=document.documentElement.scrollHeight-innerHeight;P.style.setProperty('--p',m>0?Math.min(1,scrollY/m):0)}addEventListener('scroll',sc,{passive:true});addEventListener('resize',sc);sc()})();
(function(){
var R=[
["خالدون عبر التاريخ","Immortals Through History","Immortels à travers l’histoire","Immortali attraverso la storia"],
["حكاياتٌ تُروى… وأثرٌ يبقى","Stories told… a legacy that lasts","Des récits racontés… une trace qui reste","Storie raccontate… un segno che resta"],
["بوابات المعرفة","Knowledge Gateways","Portes du savoir","Porte della conoscenza"],
["الحكايات","Stories","Histoires","Storie"],
["شخصيات المناهج","Curriculum Figures","Figures des programmes","Personaggi dei programmi"],
["كيف تُكتب الحكاية","How a Story Is Written","Comment s’écrit une histoire","Come si scrive una storia"],
["مساحة للحكايات والمعرفة والاكتشاف","A space for stories, knowledge and discovery","Un espace d’histoires, de savoir et de découverte","Uno spazio di storie, conoscenza e scoperta"],
["خالدون","Immortals","Immortels","Immortali"],
["عبر التاريخ","Through History","à travers l’histoire","attraverso la storia"],
["كل شخصية وراها حكاية، وكل إنجاز بدأ بفكرة أو موقف. هنا نكتشف الحكايات بأسلوب بسيط وممتع، ونحوّل الفضول إلى معرفة، مع مراجعة المعلومات والرجوع إلى مصادر موثوقة.","Every figure has a story, and every achievement began with an idea or a moment. Here we discover stories in a simple, enjoyable way and turn curiosity into knowledge, with checked information and reliable sources.","Chaque personnage a une histoire, et chaque réussite est née d’une idée ou d’un moment. Ici, nous découvrons des histoires de façon simple et agréable, et transformons la curiosité en savoir, avec des informations vérifiées et des sources fiables.","Ogni personaggio ha una storia e ogni impresa è nata da un’idea o da un momento. Qui scopriamo le storie in modo semplice e piacevole e trasformiamo la curiosità in conoscenza, con informazioni verificate e fonti affidabili."],
["ابدأ الحكاية ←","Start the story →","Commencer l’histoire →","Inizia la storia →"],
["اختار بوابتك للمعرفة","Choose your gateway to knowledge","Choisissez votre porte du savoir","Scegli la tua porta verso la conoscenza"],
["حكاية التاريخ بعيون جيل جديد","History through the eyes of a new generation","L’histoire vue par une nouvelle génération","La storia vista da una nuova generazione"],
["اختار اللي يشدّ فضولك","Pick what sparks your curiosity","Choisissez ce qui éveille votre curiosité","Scegli ciò che accende la tua curiosità"],
["كل باب له حكاية مختلفة","Every door has a different story","Chaque porte a une histoire différente","Ogni porta ha una storia diversa"],
["الحكايات المنشورة متاحة الآن، وباقي المسارات تُجهّز على مراحل. المسار الذي لم يُنشر فيه شيء يظهر بحالته الحقيقية.","Published stories are available now; the other tracks are being prepared in stages. A track with nothing published shows its real status.","Les histoires publiées sont disponibles dès maintenant ; les autres parcours sont préparés par étapes. Un parcours sans publication affiche son état réel.","Le storie pubblicate sono già disponibili; gli altri percorsi sono in preparazione a fasi. Un percorso senza contenuti pubblicati mostra il suo stato reale."],
["حكايات أكتوبر","October Stories","Récits d’octobre","Storie di ottobre"],
["شجاعة وابتكار وقرارات صنعت لحظات فارقة.","Courage, ingenuity and decisions that shaped turning points.","Courage, ingéniosité et décisions qui ont marqué des tournants.","Coraggio, ingegno e decisioni che hanno segnato momenti decisivi."],
["4 حكايات منشورة ←","4 published stories →","4 histoires publiées →","4 storie pubblicate →"],
["العلم والعلماء","Science and Scientists","Science et scientifiques","Scienza e scienziati"],
["اكتشافات وأسئلة وأفكار غيّرت فهمنا للعالم.","Discoveries, questions and ideas that changed how we understand the world.","Des découvertes, des questions et des idées qui ont changé notre compréhension du monde.","Scoperte, domande e idee che hanno cambiato la nostra comprensione del mondo."],
["مسار قيد الإعداد","Track in preparation","Parcours en préparation","Percorso in preparazione"],
["التعليم والمعرفة","Education and Knowledge","Éducation et savoir","Istruzione e conoscenza"],
["حكايات تشرح كيف نتعلّم، ونفكّر، ونصل إلى الإجابة.","Stories about how we learn, think and reach answers.","Des histoires sur la façon d’apprendre, de réfléchir et de trouver des réponses.","Storie su come impariamo, pensiamo e arriviamo alle risposte."],
["المشاهير والرياضة والفنون","Celebrities, Sports and Arts","Célébrités, sport et arts","Celebrità, sport e arti"],
["من محمد صلاح إلى أصحاب المواهب والإنجازات؛ النجاح له حكاية وراء الأضواء.","From Mohamed Salah to talented achievers: success has a story behind the spotlight.","De Mohamed Salah aux talents et aux réussites : le succès a une histoire derrière les projecteurs.","Da Mohamed Salah a chi ha talento e successi: il successo ha una storia dietro i riflettori."],
["التاريخ والحضارات","History and Civilizations","Histoire et civilisations","Storia e civiltà"],
["شخصيات وأماكن وأحداث نفهمها من خلال سياقها وحكاياتها.","Figures, places and events understood through their context and stories.","Des personnages, des lieux et des événements compris à travers leur contexte et leurs histoires.","Personaggi, luoghi ed eventi compresi attraverso il loro contesto e le loro storie."],
["حكايات من اقتراح القرّاء","Stories Suggested by Readers","Histoires proposées par les lecteurs","Storie suggerite dai lettori"],
["فكرة من طالب أو قارئ ممكن تكون بداية لحكاية كبيرة، بعد المراجعة والموافقة.","An idea from a student or reader can start a big story, after review and approval.","L’idée d’un élève ou d’un lecteur peut devenir une grande histoire, après relecture et approbation.","L’idea di uno studente o di un lettore può diventare una grande storia, dopo revisione e approvazione."],
["اعرف طريقة المشاركة ←","See how to take part →","Voir comment participer →","Scopri come partecipare →"],
["شخصيات المناهج المصرية","Egyptian Curriculum Figures","Figures des programmes égyptiens","Personaggi dei programmi egiziani"],
["الشخصيات الواردة في كتب المدرسة، مرتبة حسب المرحلة والصف والمادة والفصل الدراسي.","Figures appearing in school textbooks, organized by stage, grade, subject and term.","Les personnages des manuels scolaires, classés par cycle, classe, matière et semestre.","I personaggi dei libri di scuola, organizzati per ciclo, classe, materia e quadrimestre."],
["اختر صفك ←","Choose your grade →","Choisissez votre classe →","Scegli la tua classe →"],
["اقرأ واكتشف","Read and discover","Lisez et découvrez","Leggi e scopri"],
["الحكايات المنشورة","Published Stories","Histoires publiées","Storie pubblicate"],
["دي الحكايات المتاحة حاليًا. ابحث، أو صفّي حسب القسم والصف الدراسي للراوي.","These are the stories available now. Search, or filter by section and the narrator’s grade.","Voici les histoires disponibles actuellement. Cherchez, ou filtrez par rubrique et par classe du narrateur.","Queste sono le storie disponibili ora. Cerca, oppure filtra per sezione e classe del narratore."],
["ابحث عن حكاية","Search for a story","Rechercher une histoire","Cerca una storia"],
["اكتب اسم الحكاية أو كلمة منها…","Type the story title or a word from it…","Saisissez le titre ou un mot de l’histoire…","Scrivi il titolo o una parola della storia…"],
["كل الصفوف","All grades","Toutes les classes","Tutte le classi"],
["كل الأقسام","All sections","Toutes les rubriques","Tutte le sezioni"],
["مش لاقي حكاية بالكلمة دي. جرّب كلمة تانية.","No story matches that word. Try another one.","Aucune histoire ne correspond à ce mot. Essayez-en un autre.","Nessuna storia corrisponde a questa parola. Provane un’altra."],
["الروابط تفتح صفحات الحكايات في الموقع الحالي؛ لم تتغير الصفحات المنشورة أو رموز QR. الصف المعروض هو صف الطالب الراوي وليس صف المنهج.","The links open story pages on the current site; the published pages and QR codes are unchanged. The grade shown is the narrating student’s grade, not the curriculum grade.","Les liens ouvrent les pages d’histoires du site actuel ; les pages publiées et les codes QR n’ont pas changé. La classe affichée est celle de l’élève narrateur, pas celle du programme.","I link aprono le pagine delle storie del sito attuale; le pagine pubblicate e i codici QR non sono cambiati. La classe indicata è quella dello studente narratore, non quella del programma."],
["رجال البحر في أكتوبر","Men of the Sea in October","Les hommes de la mer en octobre","Gli uomini del mare in ottobre"],
["المعركة التي لم يرها معظم الناس.","The battle most people never saw.","La bataille que la plupart des gens n’ont pas vue.","La battaglia che la maggior parte delle persone non ha visto."],
["العقل قبل السلاح","Brains Before Weapons","L’intelligence avant les armes","L’ingegno prima delle armi"],
["كيف فتحت المياه طريق العبور.","How water opened a passage across the canal.","Comment l’eau a ouvert un passage à travers le canal.","Come l’acqua ha aperto un passaggio attraverso il canale."],
["لغة لا يفهمها العدو","A Language the Enemy Could Not Understand","Une langue que l’ennemi ne comprenait pas","Una lingua che il nemico non capiva"],
["حكاية الشفرة النوبية.","The story of the Nubian code.","L’histoire du code nubien.","La storia del codice nubiano."],
["سماء أكتوبر: شهداء الضربة الجوية الأولى","October Skies: The Martyrs of the First Air Strike","Le ciel d’octobre : les martyrs de la première frappe aérienne","I cieli di ottobre: i martiri del primo attacco aereo"],
["حكاية الطيارين الذين فتحوا الطريق للعبور.","The pilots who helped open a way across the canal.","Les pilotes qui ont contribué à ouvrir la voie à travers le canal.","I piloti che contribuirono ad aprire una via attraverso il canale."],
["الصف الأول الإعدادي","1st Year of Preparatory School","1re année du collège","1ª media"],
["الصف الثالث الابتدائي","3rd Grade (Primary)","3e année du primaire","3ª classe della scuola primaria"],
["الصف الأول الابتدائي","1st Grade (Primary)","1re année du primaire","1ª classe della scuola primaria"],
["اقرأ الحكاية ←","Read the story →","Lire l’histoire →","Leggi la storia →"],
["من الكتاب المدرسي إلى الحكاية","From the textbook to the story","Du manuel scolaire à l’histoire","Dal libro di testo alla storia"],
["المناهج المصرية فقط في البداية، والهيكل جاهز لكل الصفوف. لا تُدرج شخصية إلا من الكتاب نفسه مع الطبعة والعام الدراسي ورقم الصفحة.","Egyptian curricula only at first, with the structure ready for every grade. A figure is listed only from the book itself, with edition, school year and page number.","Programmes égyptiens uniquement au début, avec une structure prête pour toutes les classes. Un personnage n’est listé que d’après le manuel lui-même, avec l’édition, l’année scolaire et la page.","All’inizio solo i programmi egiziani, con la struttura pronta per tutte le classi. Un personaggio viene inserito solo dal libro stesso, con edizione, anno scolastico e numero di pagina."],
["اختر صفًا لتعرف حالة التوثيق فيه.","Choose a grade to see its documentation status.","Choisissez une classe pour voir l’état de sa documentation.","Scegli una classe per vedere lo stato della documentazione."],
["المرحلة الابتدائية","Primary stage","Cycle primaire","Scuola primaria"],
["المرحلة الإعدادية","Preparatory stage","Collège","Scuola media"],
["المرحلة الثانوية","Secondary stage","Lycée","Scuola superiore"],
["المادة","Subject","Matière","Materia"],
["الفصل الدراسي","Term","Semestre","Quadrimestre"],
["الشخصيات الواردة في الكتاب","Figures in the book","Personnages du manuel","Personaggi del libro"],
["الحكاية والمصادر","Story and sources","Histoire et sources","Storia e fonti"],
["لم يبدأ التوثيق بعد","Documentation not started yet","Documentation pas encore commencée","Documentazione non ancora iniziata"],
["الهيكل جاهز. نسجّل لكل كتاب الطبعة والعام الدراسي والصفحة، ولا تظهر قائمة قبل التحقق منها من الكتاب نفسه.","The structure is ready. For each book we record the edition, school year and page, and no list appears until it is verified against the book itself.","La structure est prête. Pour chaque manuel, nous notons l’édition, l’année scolaire et la page, et aucune liste n’apparaît avant d’être vérifiée dans le manuel.","La struttura è pronta. Per ogni libro registriamo edizione, anno scolastico e pagina, e nessun elenco compare prima di essere verificato sul libro stesso."],
["كيف نكتب الحكاية","How we write the story","Comment nous écrivons l’histoire","Come scriviamo la storia"],
["صوت الراوي… ثم التوثيق","The narrator’s voice… then the documentation","La voix du narrateur… puis la documentation","La voce del narratore… poi la documentazione"],
["كل حكاية من جزأين واضحين، ولا نخلط بينهما.","Every story has two clear parts, and we never mix them.","Chaque histoire comporte deux parties distinctes, que nous ne mélangeons jamais.","Ogni storia ha due parti distinte, che non mescoliamo mai."],
["١ — حكاية بصوت الراوي","1 — A story in the narrator’s voice","1 — Une histoire à la voix du narrateur","1 — Una storia con la voce del narratore"],
["الطالب أو الراوي يحكي بأسلوبه، وتحريرنا خفيف دون تغيير صوته.","The student or narrator tells it in their own style; our editing is light and keeps their voice.","L’élève ou le narrateur raconte à sa manière ; notre relecture est légère et préserve sa voix.","Lo studente o narratore racconta a modo suo; la nostra revisione è leggera e ne conserva la voce."],
["صوت الطالب","Student’s voice","Voix de l’élève","Voce dello studente"],
["«كتبتها بكلماتي، وبحثت عن مصدر كل معلومة.»","“I wrote it in my own words and looked for the source of every fact.”","« Je l’ai écrite avec mes mots et j’ai cherché la source de chaque information. »","«L’ho scritta con parole mie e ho cercato la fonte di ogni informazione.»"],
["٢ — سرد موثق","2 — A documented account","2 — Un récit documenté","2 — Un racconto documentato"],
["معلومات محققة بمصادر محددة، مع فصل الحقائق عن التفسيرات، وإعلان دور الذكاء الاصطناعي إن كان كبيرًا.","Verified information with specific sources, facts separated from interpretations, and AI’s role disclosed when substantial.","Des informations vérifiées avec des sources précises, les faits distingués des interprétations, et le rôle de l’IA indiqué lorsqu’il est important.","Informazioni verificate con fonti precise, fatti distinti dalle interpretazioni e ruolo dell’IA dichiarato quando è rilevante."],
["مشاركة الطلاب والمدارس والأفراد","Contributions from students, schools and individuals","Contributions des élèves, des écoles et des particuliers","Contributi di studenti, scuole e privati"],
["الإرسال لا يعني النشر.","Submitting does not mean publishing.","Envoyer ne veut pas dire publier.","Inviare non significa pubblicare."],
["تُرسل الفكرة أو الحكاية بالعربية.","The idea or story is submitted in Arabic.","L’idée ou l’histoire est envoyée en arabe.","L’idea o la storia viene inviata in arabo."],
["تُراجع الحقائق والمصادر.","Facts and sources are reviewed.","Les faits et les sources sont vérifiés.","Fatti e fonti vengono verificati."],
["يُعرض النص العربي للاعتماد قبل أي ترجمة.","The Arabic text is shown for approval before any translation.","Le texte arabe est présenté pour approbation avant toute traduction.","Il testo arabo viene sottoposto ad approvazione prima di ogni traduzione."],
["تُنشر بعد الموافقة فقط.","Published only after approval.","Publiée seulement après approbation.","Pubblicata solo dopo l’approvazione."],
["لا نعرض الاسم الكامل أو الصورة أو اسم المدرسة أو بيانات التواصل لأي طفل دون موافقة.","We never show a child’s full name, photo, school name or contact details without consent.","Nous n’affichons jamais le nom complet, la photo, l’école ou les coordonnées d’un enfant sans consentement.","Non mostriamo mai nome completo, foto, nome della scuola o contatti di un minore senza consenso."],
["اكتب حكايتك","Write your story","Écrivez votre histoire","Scrivi la tua storia"],
["للانتقال إلى الموقع الحالي:","To go to the current site:","Pour aller au site actuel :","Per andare al sito attuale:"],
["حكايات أكتوبر 1973 ←","October 1973 Stories →","Récits d’octobre 1973 →","Storie di ottobre 1973 →"],
["العودة إلى الأعلى ↑","Back to top ↑","Retour en haut ↑","Torna su ↑"],
["نسخة معاينة مستقلة — لا تغيّر الموقع المنشور. الحكايات والمسارات الجديدة تُراجع قبل اعتمادها.","Standalone preview — it does not change the published site. New stories and tracks are reviewed before approval.","Aperçu autonome — il ne modifie pas le site publié. Les nouvelles histoires et parcours sont relus avant approbation.","Anteprima indipendente — non modifica il sito pubblicato. Le nuove storie e i nuovi percorsi vengono rivisti prima dell’approvazione."],
["معاينة مستقلة","Standalone preview","Aperçu autonome","Anteprima indipendente"],
["☀️ فاتح","☀️ Light","☀️ Clair","☀️ Chiaro"],
["🌙 داكن","🌙 Dark","🌙 Sombre","🌙 Scuro"]
];
R.push(
['بوابات تقودك إلى عوالم متنوعة، ولكل مجموعة حكاياتها وطابعها الخاص.','Gateways leading to diverse worlds, each collection with its own stories and character.','Des portes vers des mondes variés, chaque collection ayant ses histoires et son caractère.','Porte verso mondi diversi, ognuna con le proprie storie e il proprio carattere.'],
['من الفكرة إلى الحكاية','From idea to story','De l’idée à l’histoire','Dall’idea alla storia'],
['عايز تقترح حكاية أو تكتب واحدة؟','Want to suggest a story or write one?','Vous voulez proposer une histoire ou en écrire une ?','Vuoi proporre una storia o scriverne una?'],
['كل حكاية هنا تبدأ بسؤال أو فكرة تستحق البحث. مش لازم تكون كاتبًا محترفًا؛ المهم أن تكون الفكرة واضحة، ونراجع المعلومات قبل عرضها للقراء.','Every story here begins with a question or an idea worth researching. You don’t have to be a professional writer; what matters is a clear idea, and we check the information before showing it to readers.','Chaque histoire ici commence par une question ou une idée qui mérite d’être explorée. Nul besoin d’être un écrivain professionnel ; l’essentiel est une idée claire, et nous vérifions les informations avant de les présenter aux lecteurs.','Ogni storia qui nasce da una domanda o da un’idea che merita di essere approfondita. Non serve essere uno scrittore professionista: conta che l’idea sia chiara, e noi verifichiamo le informazioni prima di mostrarle ai lettori.'],
['تبدأ الحكاية إزاي؟','How does a story begin?','Comment commence une histoire ?','Come nasce una storia?'],
['اختار الفكرة','Choose the idea','Choisissez l’idée','Scegli l’idea'],
['شخصية أو موقف أو اكتشاف أو حدث تاريخي؛ وحدد إيه السؤال اللي عايز الحكاية تجاوب عنه.','A figure, a moment, a discovery or a historical event; and decide which question the story should answer.','Un personnage, une situation, une découverte ou un événement historique ; et définissez la question à laquelle l’histoire doit répondre.','Un personaggio, una situazione, una scoperta o un evento storico; e stabilisci a quale domanda la storia deve rispondere.'],
['اجمع معلومات موثوقة','Gather reliable information','Rassemblez des informations fiables','Raccogli informazioni affidabili'],
['دوّن الأسماء والتواريخ والتفاصيل المهمة، واحتفظ بروابط الكتب أو المواقع والمراجع اللي اعتمدت عليها.','Note names, dates and key details, and keep links to the books, sites and references you relied on.','Notez les noms, les dates et les détails importants, et conservez les liens vers les livres, sites et références utilisés.','Annota nomi, date e dettagli importanti e conserva i link a libri, siti e riferimenti che hai usato.'],
['احكِها ببساطة','Tell it simply','Racontez-la simplement','Raccontala in modo semplice'],
['ابدأ بمشهد أو سؤال يجذب القارئ، ثم رتّب الأحداث بوضوح، واشرح معنى الإنجاز بدل ما تكتفي بسرد المعلومات.','Start with a scene or question that draws the reader in, then lay out events clearly and explain what the achievement means instead of just listing facts.','Commencez par une scène ou une question qui attire le lecteur, puis ordonnez clairement les événements et expliquez le sens de l’exploit au lieu de simplement énumérer des informations.','Inizia con una scena o una domanda che attiri il lettore, poi ordina chiaramente gli eventi e spiega il significato dell’impresa invece di elencare solo informazioni.'],
['اذكر الصور والمصادر','Credit images and sources','Citez les images et les sources','Cita immagini e fonti'],
['لكل صورة مصدر وحقوق استخدام لازم نتحقق منها. لو الصورة توضيحية أو مولّدة بالذكاء الاصطناعي، نوضح ده صراحة.','Every image has a source and usage rights we must verify. If an image is illustrative or AI-generated, we say so openly.','Chaque image a une source et des droits d’utilisation que nous devons vérifier. Si l’image est illustrative ou générée par IA, nous le précisons clairement.','Ogni immagine ha una fonte e diritti d’uso che dobbiamo verificare. Se l’immagine è illustrativa o generata dall’IA, lo dichiariamo apertamente.'],
['إحنا بنجهّز الحكاية للنشر إزاي؟','How do we prepare a story for publishing?','Comment préparons-nous une histoire pour la publication ?','Come prepariamo una storia per la pubblicazione?'],
['نحتفظ بالنص الأصلي','We keep the original text','Nous conservons le texte original','Conserviamo il testo originale'],
['نحافظ على النص كما وصل، ونفصل بينه وبين النسخة المحررة حتى لا تضيع فكرة صاحب الاقتراح.','We keep the text as received and separate it from the edited version so the suggester’s idea isn’t lost.','Nous gardons le texte tel qu’il est arrivé et le séparons de la version éditée afin de ne pas perdre l’idée de son auteur.','Conserviamo il testo così com’è arrivato e lo teniamo separato dalla versione modificata, così l’idea di chi l’ha proposta non va persa.'],
['نراجع الوقائع','We check the facts','Nous vérifions les faits','Verifichiamo i fatti'],
['نتحقق من الأسماء والتواريخ والتفاصيل باستخدام مصادر مناسبة، ونوضح أي معلومة غير مؤكدة أو مختلف عليها.','We verify names, dates and details using suitable sources, and flag anything uncertain or disputed.','Nous vérifions les noms, les dates et les détails à l’aide de sources appropriées, et signalons toute information incertaine ou contestée.','Verifichiamo nomi, date e dettagli con fonti adeguate e segnaliamo ogni informazione incerta o controversa.'],
['نحرّر ونراجع','We edit and review','Nous éditons et relisons','Modifichiamo e rivediamo'],
['نضبط السرد ليناسب السن المستهدف، ونراجع اللغة والعناوين والترجمات والصور والروابط وتجربة الهاتف والكمبيوتر.','We adjust the narration to suit the target age and review language, titles, translations, images, links and the phone and computer experience.','Nous adaptons le récit à l’âge visé et relisons la langue, les titres, les traductions, les images, les liens et l’expérience sur mobile et ordinateur.','Adattiamo la narrazione all’età di destinazione e rivediamo lingua, titoli, traduzioni, immagini, link e l’esperienza su telefono e computer.'],
['ننتظر الموافقة','We wait for approval','Nous attendons l’approbation','Aspettiamo l’approvazione'],
['تظل الحكاية مسودة حتى يوافق المسؤول عن المشروع صراحة. لا تُنشر أي حكاية أو بيانات خاصة قبل الاعتماد.','A story stays a draft until the project lead explicitly approves it. No story or private data is published before approval.','Une histoire reste un brouillon jusqu’à l’approbation explicite du responsable du projet. Aucune histoire ni donnée privée n’est publiée avant validation.','Una storia resta una bozza finché il responsabile del progetto non la approva esplicitamente. Nessuna storia o dato privato viene pubblicato prima dell’approvazione.'],
['مهم قبل إرسال اقتراح','Important before sending a suggestion','Important avant d’envoyer une proposition','Importante prima di inviare una proposta'],
['اكتب عنوانًا مبدئيًا، وفكرة الحكاية في سطور، والسن المناسب للقارئ، وأي مصادر متاحة. لا ترسل بيانات شخصية لا تحتاجها الحكاية، ولا تستخدم صورة لمجرد أنها ظهرت في نتائج البحث.','Write a working title, the story idea in a few lines, the suitable reader age, and any available sources. Don’t send personal data the story doesn’t need, and don’t use an image just because it showed up in search results.','Écrivez un titre provisoire, l’idée de l’histoire en quelques lignes, l’âge de lecteur adapté et les sources disponibles. N’envoyez pas de données personnelles inutiles à l’histoire et n’utilisez pas une image simplement parce qu’elle apparaît dans les résultats de recherche.','Scrivi un titolo provvisorio, l’idea della storia in poche righe, l’età adatta al lettore e le fonti disponibili. Non inviare dati personali inutili alla storia e non usare un’immagine solo perché è apparsa nei risultati di ricerca.'],
['إيه اللي يخلّي الحكاية مناسبة للمشروع؟','What makes a story right for the project?','Qu’est-ce qui rend une histoire adaptée au projet ?','Cosa rende una storia adatta al progetto?'],
['دقة تاريخية، حكاية مفهومة ومشوقة، احترام الأشخاص والأحداث، مصادر يمكن الرجوع إليها، وصور نعرف مصدرها وحقوق استخدامها. الاقتراح لا يعني النشر التلقائي؛ كل مادة تمر بالمراجعة والموافقة أولًا.','Historical accuracy, a clear and engaging story, respect for people and events, sources that can be consulted, and images whose source and usage rights we know. A suggestion does not mean automatic publishing; every item goes through review and approval first.','Exactitude historique, histoire claire et captivante, respect des personnes et des événements, sources consultables et images dont nous connaissons la source et les droits. Une proposition n’entraîne pas une publication automatique ; chaque contenu passe d’abord par la relecture et l’approbation.','Accuratezza storica, una storia chiara e coinvolgente, rispetto per persone ed eventi, fonti consultabili e immagini di cui conosciamo fonte e diritti d’uso. Una proposta non significa pubblicazione automatica: ogni contenuto passa prima da revisione e approvazione.'],
['كل حكاية من جزأين: حكاية بصوت الراوي، ثم سرد موثق بمصادر محددة مع فصل الحقائق عن التفسيرات.','Every story has two parts: a story in the narrator’s voice, then a documented account with specific sources, separating facts from interpretations.','Chaque histoire comporte deux parties : un récit à la voix du narrateur, puis un récit documenté avec des sources précises, distinguant faits et interprétations.','Ogni storia ha due parti: un racconto con la voce del narratore, poi un racconto documentato con fonti precise, che distingue i fatti dalle interpretazioni.'],
['لوحة الألوان','Color palette','Palette de couleurs','Palette dei colori'],
['للمراجعة فقط وتُحذف قبل النشر.','For review only; removed before publishing.','Pour relecture uniquement ; supprimée avant la publication.','Solo per revisione; verrà rimossa prima della pubblicazione.']
);
R.push(['ادخل بوابة أكتوبر ←','Enter the October gateway →','Entrer dans la porte d’octobre →','Entra nella porta di ottobre →']);R.push(["حكايات شخصيات مختارة وردت في المناهج المصرية، مصنفة حسب المرحلة والصف والمادة.", "Stories of selected figures from the Egyptian curricula, organized by stage, grade and subject.", "Des histoires de personnages choisis dans les programmes égyptiens, classées par cycle, classe et matière.", "Storie di personaggi scelti dai programmi egiziani, organizzate per ciclo, classe e materia."],["حكايات من الكتاب المدرسي", "Stories from the school textbook", "Des histoires tirées du manuel scolaire", "Storie dal libro di scuola"],["حكايات ممتعة وموثقة لشخصيات مختارة وردت في المناهج المصرية، مصنفة حسب المرحلة والصف والمادة. لا ندّعي أننا نغطي المنهج كله، والمجموعة تكبر تدريجيًا.", "Enjoyable, documented stories of selected figures from the Egyptian curricula, organized by stage, grade and subject. We don’t claim to cover the whole curriculum; the collection grows gradually.", "Des histoires captivantes et documentées de personnages choisis dans les programmes égyptiens, classées par cycle, classe et matière. Nous ne prétendons pas couvrir tout le programme ; la collection s’enrichit progressivement.", "Storie piacevoli e documentate di personaggi scelti dai programmi egiziani, organizzate per ciclo, classe e materia. Non pretendiamo di coprire l’intero programma; la raccolta cresce gradualmente."],["اختر صفًا لتعرف الحكايات المتاحة فيه.", "Choose a grade to see the stories available in it.", "Choisissez une classe pour voir les histoires disponibles.", "Scegli una classe per vedere le storie disponibili."],["كيف تُروى حكاية الشخصية؟", "How is a figure’s story told?", "Comment raconte-t-on l’histoire d’un personnage ?", "Come si racconta la storia di un personaggio?"],["بصوت الراوي", "In the narrator’s voice", "À la voix du narrateur", "Con la voce del narratore"],["في ضوء التاريخ", "In the light of history", "À la lumière de l’histoire", "Alla luce della storia"],["المصادر", "Sources", "Sources", "Fonti"],["أسئلة تفاعلية عند الملاءمة", "Interactive questions where suitable", "Questions interactives lorsque c’est adapté", "Domande interattive quando adatte"],["الصور والترجمة", "Images and translation", "Images et traduction", "Immagini e traduzione"],["«بصوت الراوي» حكاية بسيطة تحافظ على صوت الطالب، ثم «في ضوء التاريخ» يشرح السياق ويصحح المعلومات ويستند إلى مراجع موثوقة، مع توضيح أي معلومة غير مؤكدة. العربية لغة أساسية، ثم تُجهّز الإنجليزية والفرنسية والإيطالية تدريجيًا.", "“In the narrator’s voice” is a simple story that keeps the student’s voice; “In the light of history” then explains the context, corrects information and relies on reliable references, flagging anything uncertain. Arabic is the main language, with English, French and Italian prepared gradually.", "« À la voix du narrateur » est un récit simple qui garde la voix de l’élève ; « À la lumière de l’histoire » explique ensuite le contexte, corrige les informations et s’appuie sur des références fiables, en signalant tout point incertain. L’arabe est la langue principale ; l’anglais, le français et l’italien sont préparés progressivement.", "«Con la voce del narratore» è un racconto semplice che conserva la voce dello studente; «Alla luce della storia» spiega poi il contesto, corregge le informazioni e si basa su riferimenti affidabili, segnalando ciò che è incerto. L’arabo è la lingua principale; inglese, francese e italiano vengono preparati gradualmente."],["المرحلة", "Stage", "Cycle", "Ciclo"],["الصف", "Grade", "Classe", "Classe"],["لا توجد حكايات منشورة في هذا الصف بعد", "No stories published for this grade yet", "Aucune histoire publiée pour cette classe pour l’instant", "Nessuna storia pubblicata per questa classe per ora"],["الحكايات تُضاف تدريجيًا وتُصنَّف حسب المادة (مثل اللغة العربية والدراسات الاجتماعية والعلوم) بحسب ورود الشخصية فعلًا في الكتاب.", "Stories are added gradually and classified by subject (such as Arabic, social studies and science) according to where the figure actually appears in the book.", "Les histoires sont ajoutées progressivement et classées par matière (par exemple arabe, études sociales et sciences) selon la présence réelle du personnage dans le manuel.", "Le storie vengono aggiunte gradualmente e classificate per materia (ad esempio arabo, studi sociali e scienze) in base a dove il personaggio compare davvero nel libro."]);R.push(["هنا نقابل شخصيات مرّت علينا في كتب المدرسة، ونكتشف وراءها حكاية ممتعة وموثقة: مين هو؟ وإيه اللي عمله؟ وليه لسه بنتكلم عنه؟", "Here we meet figures who appeared in our school books and discover an enjoyable, documented story behind them: who were they, what did they do, and why do we still talk about them?", "Ici, nous rencontrons des personnages croisés dans les manuels scolaires et découvrons derrière eux une histoire captivante et documentée : qui était-il, qu’a-t-il fait, et pourquoi parle-t-on encore de lui ?", "Qui incontriamo personaggi apparsi nei libri di scuola e scopriamo dietro di loro una storia piacevole e documentata: chi era, che cosa ha fatto e perché ne parliamo ancora?"],["→ العودة إلى الرئيسية", "← Back to home", "← Retour à l’accueil", "← Torna alla home"],["إيه هو القسم ده؟", "What is this section?", "Qu’est-ce que cette rubrique ?", "Che cos’è questa sezione?"],["قسم حكايات، مش شرح للمنهج. مش بنشرح الدروس ولا بنعيد كتابة الكتب؛ بنختار شخصيات وردت في المناهج المصرية ونحكي قصتها بشكل ممتع وموثق. وهو مش مكتبة مدرسية بتجمع كل شخصيات الكتب، لكنه مجموعة مختارة بتكبر تدريجيًا.", "A section of stories, not a curriculum guide. We don’t explain lessons or rewrite textbooks; we pick figures who appear in the Egyptian curricula and tell their story in an enjoyable, documented way. It isn’t a school library collecting every figure in the books, but a selected collection that grows gradually.", "Une rubrique d’histoires, pas un guide du programme. Nous n’expliquons pas les leçons ni ne réécrivons les manuels ; nous choisissons des personnages des programmes égyptiens et racontons leur histoire de façon captivante et documentée. Ce n’est pas une bibliothèque scolaire réunissant tous les personnages des manuels, mais une sélection qui s’enrichit progressivement.", "Una sezione di storie, non una guida al programma. Non spieghiamo le lezioni né riscriviamo i libri; scegliamo personaggi dei programmi egiziani e ne raccontiamo la storia in modo piacevole e documentato. Non è una biblioteca scolastica con tutti i personaggi dei libri, ma una raccolta selezionata che cresce gradualmente."],["بنصنّف الحكايات إزاي؟", "How do we organize the stories?", "Comment classons-nous les histoires ?", "Come organizziamo le storie?"],["المرحلة التعليمية", "Educational stage", "Cycle d’enseignement", "Ciclo scolastico"],["ابتدائي، إعدادي، ثانوي.", "Primary, preparatory, secondary.", "Primaire, collège, lycée.", "Primaria, media, superiore."],["الصف الدراسي", "Grade", "Classe", "Classe"],["من أول صف في المرحلة إلى آخر صف فيها.", "From the first grade of the stage to the last.", "De la première à la dernière classe du cycle.", "Dalla prima all’ultima classe del ciclo."],["المادة أو الكتاب", "Subject or book", "Matière ou manuel", "Materia o libro"],["مثل اللغة العربية والدراسات الاجتماعية والعلوم، حسب ورود الشخصية فعلًا.", "Such as Arabic, social studies and science, according to where the figure actually appears.", "Par exemple arabe, études sociales et sciences, selon la présence réelle du personnage.", "Ad esempio arabo, studi sociali e scienze, in base a dove il personaggio compare davvero."],["اختر صفك", "Choose your grade", "Choisissez votre classe", "Scegli la tua classe"],["اختر المرحلة والصف لتعرف الحكايات المتاحة فيهما.", "Choose the stage and grade to see the stories available.", "Choisissez le cycle et la classe pour voir les histoires disponibles.", "Scegli ciclo e classe per vedere le storie disponibili."],["كيف نضمن الدقة؟", "How do we ensure accuracy?", "Comment garantissons-nous l’exactitude ?", "Come garantiamo l’accuratezza?"],["بنرجع لمصادر موثوقة وبنوضح أي معلومة غير مؤكدة، ونختار صورًا موثقة قدر الإمكان، ولا تُنشر أي حكاية قبل المراجعة والموافقة.", "We rely on reliable sources, flag anything uncertain, choose documented images where possible, and no story is published before review and approval.", "Nous nous appuyons sur des sources fiables, signalons toute information incertaine, choisissons des images documentées autant que possible, et aucune histoire n’est publiée avant relecture et approbation.", "Ci basiamo su fonti affidabili, segnaliamo ciò che è incerto, scegliamo immagini documentate per quanto possibile e nessuna storia viene pubblicata prima di revisione e approvazione."]);R.push(["اقترح حكاية", "Suggest a story", "Proposer une histoire", "Proponi una storia"],["اقترح حكاية في هذا الصف", "Suggest a story for this grade", "Proposer une histoire pour cette classe", "Proponi una storia per questa classe"]);R.push(["١", "1", "1", "1"],["٢", "2", "2", "2"],["٣", "3", "3", "3"],["٤", "4", "4", "4"],["٥", "5", "5", "5"],["٦", "6", "6", "6"]);var D={};R.forEach(function(r){D[r[0]]=r.slice(1)});
var O={"الأول":1,"الثاني":2,"الثالث":3,"الرابع":4,"الخامس":5,"السادس":6};
var N={"نوردين":"Nourdeen","كارما":"Karma","مليكة":"Malika"};
/* هذا المترجم يغطي العربية والإنجليزية والفرنسية والإيطالية فقط؛ الألمانية لها مترجم مستقل في khaledoon-de.js. لا نقرأ قائمة KH_LANG ذات الخمس لغات هنا كي لا يُمرَّر فهرس DE (4) إلى قواميس ذات أربعة أعمدة. */
var LG=["ar","en","fr","it"],l=0,de=document.documentElement,B=document.body,q=document.getElementById("q"),th=document.getElementById("th");
var T0=document.title,BR="خالدون عبر التاريخ",PV="معاينة مستقلة",PH=q?q.placeholder:"";
window.KH_AR_TITLE=T0;
function sv(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function gr(w,i){return ["Grade ","Classe ","Classe "][i-1]+O[w]}
function tr(s,i){
var d=D[s],m;if(d)return d[i-1];
if(m=s.match(/^بصوت (\S+) • (.+)$/))return ["By ","Par ","Di "][i-1]+(N[m[1]]||m[1])+" • "+tr(m[2],i);
if(m=s.match(/^(المرحلة \S+) — الصف (\S+)$/))return tr(m[1],i)+" — "+gr(m[2],i);
m=s.match(/^الصف (\S+)$/);if(m&&O[m[1]])return gr(m[1],i);
return s}
function one(n){
if(n.__o===undefined)n.__o=n.data;
var t=n.__o.trim();if(!t)return;
n.data=l?n.__o.replace(t,tr(t,l)):n.__o}
function ap(r){
if(r.nodeType===3){one(r);return}
if(r.nodeType!==1)return;
var w=document.createTreeWalker(r,4,{acceptNode:function(n){var p=n.parentNode.nodeName;return p==="SCRIPT"||p==="STYLE"?2:1}}),n;
while(n=w.nextNode())one(n)}
function sl(i){
l=i;sv("kh-lang",LG[i]);de.lang=LG[i];de.dir=i?"ltr":"rtl";
ap(B);
document.title=i?T0.split(" | ").map(function(p){return tr(p,i)}).join(" | "):T0;
if(q)q.placeholder=i?tr(PH,i):PH;
Array.prototype.forEach.call(document.querySelectorAll(".langs button"),function(b){b.setAttribute("aria-pressed",String(+b.dataset.l===i))})}
function sth(t){
de.setAttribute("data-theme",t);sv("kh-theme",t);
th.textContent=t==="dark"?"☀️ فاتح":"🌙 داكن";ap(th);
var mt=document.querySelector("meta[name=theme-color]");if(mt)mt.content=t==="dark"?"#050b10":"#faf5e8"}
new MutationObserver(function(ms){if(!l)return;ms.forEach(function(m){Array.prototype.forEach.call(m.addedNodes,ap)})}).observe(B,{childList:true,subtree:true});
document.querySelector(".langs").addEventListener("click",function(e){var b=e.target.closest("button");if(b)sl(+b.dataset.l)});
th.addEventListener("click",function(){sth(de.getAttribute("data-theme")==="dark"?"light":"dark")});
var sg="ar";try{sg=localStorage.getItem("kh-lang")||"ar"}catch(e){}
var si=LG.indexOf(sg);l=Math.max(si,0);
sth(de.getAttribute("data-theme")||"dark");
if(si>0)sl(si)
})();
(function(){
var c=document.getElementById('bg'),x=c.getContext('2d'),P=[],W,H,r=matchMedia('(prefers-reduced-motion: reduce)').matches;
function rs(){W=c.width=innerWidth;H=c.height=innerHeight;var n=Math.min(70,Math.round(W*H/22000));P=[];for(var i=0;i<n;i++)P.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,r:Math.random()*.85+.35})}
function fr(){x.clearRect(0,0,W,H);var d=document.documentElement.getAttribute('data-theme')==='dark',g=d?'240,200,120':'27,63,148';
for(var i=0;i<P.length;i++){var p=P[i];if(!r){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1}
x.fillStyle='rgba('+g+','+(d?.92:.72)+')';x.beginPath();x.arc(p.x,p.y,p.r,0,6.283);x.fill();
for(var j=i+1;j<P.length;j++){var q=P[j],dx=p.x-q.x,dy=p.y-q.y,s=dx*dx+dy*dy;if(s<14400){x.strokeStyle='rgba('+g+','+(1-s/14400)*(d?.22:.16)+')';x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke()}}}
if(!r)requestAnimationFrame(fr)}
addEventListener('resize',function(){rs();if(r)fr()});
document.getElementById('th').addEventListener('click',function(){if(r)fr()});
rs();fr()
})();


/* Parallax بطيء لغلاف الصفحة الرئيسية فقط: النص يصعد طبيعيًا والصورة تتحرك بمعدل 8% */
(function(){
  var hero=document.querySelector('.hero:not(.sub)');
  if(!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var busy=false;
  function update(){
    var top=hero.getBoundingClientRect().top;
    var shift=Math.max(0,Math.min(260,-top*0.08));
    hero.style.setProperty('--hero-parallax',shift.toFixed(1)+'px');
    busy=false;
  }
  function requestUpdate(){if(!busy){busy=true;requestAnimationFrame(update)}}
  addEventListener('scroll',requestUpdate,{passive:true});
  addEventListener('resize',requestUpdate,{passive:true});
  update();
})();
