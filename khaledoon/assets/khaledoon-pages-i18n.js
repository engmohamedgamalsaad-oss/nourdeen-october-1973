/* خالدون عبر التاريخ — نظام اللغات للصفحات الفرعية (الأقسام + نموذج الإرسال)
   لا يعرض شريط لغة: الشريط في الصفحة الرئيسية فقط، وهذه الصفحات تقرأ اختياره من المفتاح المشترك (kh-lang). */
(function(){
'use strict';
var LG=(window.KH_LANG&&window.KH_LANG.supported?window.KH_LANG.supported.slice():['ar','en','fr','it','de']),de=document.documentElement,l=0;
var R=[
['صورة لرأس تمثال الملكة نفرتيتي من مجموعة متحف برلين المصري','Photograph of the bust of Queen Nefertiti from the Egyptian Museum of Berlin','Photographie du buste de la reine Néfertiti du musée égyptien de Berlin','Fotografia del busto della regina Nefertiti del Museo Egizio di Berlino','Foto der Büste von Königin Nofretete aus dem Ägyptischen Museum Berlin'],
['تمثال حتشبسوت المحفوظ في متحف المتروبوليتان للفنون','Statue of Hatshepsut kept in the Metropolitan Museum of Art','Statue d’Hatchepsout conservée au Metropolitan Museum of Art','Statua di Hatshepsut conservata al Metropolitan Museum of Art','Statue der Hatschepsut im Metropolitan Museum of Art'],
['لوحة جدارية رومانية يُحتمل أنها تمثل كليوباترا السابعة','Roman wall painting that probably depicts Cleopatra VII','Peinture murale romaine représentant probablement Cléopâtre VII','Affresco romano che probabilmente raffigura Cleopatra VII','Römisches Wandgemälde, das wahrscheinlich Kleopatra VII. darstellt'],
['شخصيات إسلامية','Islamic Figures','Figures de l’islam','Figure islamiche'],
['من سير شخصيات تركت أثرًا','Lives of figures who left a lasting mark','La vie de figures qui ont marqué leur époque','Le vite di figure che hanno lasciato il segno'],
['حكايات موثقة عن شخصيات إسلامية أسهمت في التاريخ والعلم والفكر، مع عرض سياقها ومصادرها.','Documented stories of Islamic figures who contributed to history, scholarship and thought, with context and sources.','Récits documentés de figures de l’islam qui ont contribué à l’histoire, au savoir et à la pensée, avec leur contexte et leurs sources.','Storie documentate di figure islamiche che hanno contribuito alla storia, al sapere e al pensiero, con contesto e fonti.'],
['لم تُضف حكايات إلى هذا القسم بعد.','No stories have been added to this section yet.','Aucune histoire n’a encore été ajoutée à cette rubrique.','Nessuna storia è ancora stata aggiunta a questa sezione.'],
['اقترح حكاية عن شخصية إسلامية ←','Suggest a story about an Islamic figure →','Proposez une histoire sur une figure de l’islam →','Proponi una storia su una figura islamica →'],
['خالدون عبر التاريخ','Immortals Through History','Immortels à travers l’histoire','Immortali attraverso la storia'],
['حكاية التاريخ بعيون جيل جديد','History through the eyes of a new generation','L’histoire vue par une nouvelle génération','La storia vista da una nuova generazione'],
['حكاياتٌ تُروى… وأثرٌ يبقى','Stories told… a legacy that lasts','Des récits racontés… une trace qui reste','Storie raccontate… un segno che resta'],
['← كل البوابات','← All gateways','← Toutes les portes','← Tutte le porte'],
['من حكايات المعرفة والإنسان','From the stories of knowledge and people','Parmi les histoires du savoir et de l’humain','Dalle storie della conoscenza e dell’uomo'],
['حكايات نساء تركن أثرًا','Stories of women who made a difference','Histoires de femmes qui ont marqué leur époque','Storie di donne che hanno lasciato il segno'],
['حكايات هذا القسم','Stories in this section','Histoires de cette rubrique','Storie di questa sezione'],
['كل حكاية لها صفحتها الخاصة، وتُضاف هنا بعد مراجعة المحتوى والمصادر.','Each story has its own page and is added here after its content and sources are reviewed.','Chaque histoire a sa propre page et est ajoutée ici après relecture du contenu et des sources.','Ogni storia ha la sua pagina e viene aggiunta qui dopo la revisione di contenuti e fonti.'],
['الحكايات قيد الإعداد','Stories in preparation','Histoires en préparation','Storie in preparazione'],
['لم تُضف حكايات إلى هذا القسم بعد. ستظهر هنا الحكايات المعتمدة، باستخدام نفس أسلوب العرض والتنظيم المستخدم في قسم أكتوبر 1973.','No stories have been added to this section yet. Approved stories will appear here, using the same display and layout as the October 1973 section.','Aucune histoire n’a encore été ajoutée à cette rubrique. Les histoires approuvées apparaîtront ici, avec la même présentation que la rubrique Octobre 1973.','Nessuna storia è ancora stata aggiunta a questa sezione. Le storie approvate appariranno qui, con lo stesso stile e la stessa organizzazione della sezione Ottobre 1973.'],
['قسم من «خالدون عبر التاريخ» — حكايات موثقة تُضاف بعد المراجعة والاعتماد.','A section of “Immortals Through History” — documented stories added after review and approval.','Une rubrique d’« Immortels à travers l’histoire » — des histoires documentées ajoutées après relecture et approbation.','Una sezione di «Immortali attraverso la storia» — storie documentate aggiunte dopo revisione e approvazione.'],
['العلم والعلماء','Science and Scientists','Science et scientifiques','Scienza e scienziati'],
['اكتشف حكايات العلماء وأسئلتهم وتجاربهم، وكيف تحولت الأفكار إلى معرفة وإنجازات.','Discover scientists’ stories, their questions and experiments, and how ideas became knowledge and achievements.','Découvrez les histoires des scientifiques, leurs questions et leurs expériences, et comment les idées sont devenues savoir et réussites.','Scopri le storie degli scienziati, le loro domande e i loro esperimenti, e come le idee sono diventate conoscenza e imprese.'],
['حكايات عن العلماء والأفكار والاكتشافات التي غيّرت فهمنا للعالم.','Stories about scientists, ideas and discoveries that changed how we understand the world.','Des histoires sur les scientifiques, les idées et les découvertes qui ont changé notre compréhension du monde.','Storie su scienziati, idee e scoperte che hanno cambiato la nostra comprensione del mondo.'],
['أعلام الأدب والفنون والرياضة','Figures in Literature, Arts and Sport','Figures de la littérature, des arts et du sport','Protagonisti della letteratura, delle arti e dello sport'],
['حكايات الكُتّاب والأدباء والفنانين والرياضيين الذين تركوا بصمة مميزة في مجالاتهم، وخلّدوا أسماءهم بإنجازاتهم وإسهاماتهم.','Stories of writers, artists and athletes who made a lasting mark in their fields through their achievements and contributions.','Des récits d’écrivains, d’artistes et de sportifs qui ont marqué durablement leur domaine par leurs réalisations et leurs contributions.','Storie di scrittori, artisti e sportivi che hanno lasciato un segno duraturo nei loro campi grazie ai risultati e ai contributi.'],
['حكايات الكُتّاب والأدباء والفنانين والرياضيين الذين تركوا بصمة مميزة في مجالاتهم، وخلّدوا أسماءهم بإنجازاتهم وإسهاماتهم.','Stories about writers, artists and athletes whose achievements left a lasting mark in their fields.','Des récits d’écrivains, d’artistes et de sportifs dont les réalisations ont laissé une empreinte durable dans leur domaine.','Storie di scrittori, artisti e sportivi i cui risultati hanno lasciato un segno duraturo nei loro campi.'],
['نساء خالدات','Women Who Made History','Femmes qui ont marqué l’histoire','Donne che hanno fatto la storia'],
['حكايات نساء تركن أثرًا بارزًا في التاريخ والعلم والأدب والفن والعمل الوطني والإنساني، وألهمت إنجازاتهن أجيالًا من بعدهن.','Stories of women whose achievements in history, science, literature, the arts, national service and humanitarian work inspired generations.','Des récits de femmes dont les réalisations dans l’histoire, les sciences, la littérature, les arts, l’engagement national et l’action humanitaire ont inspiré des générations.','Storie di donne i cui risultati nella storia, nella scienza, nella letteratura, nelle arti, nell’impegno nazionale e nell’attività umanitaria hanno ispirato generazioni.'],
['حكايات نساء تركن أثرًا بارزًا في التاريخ والعلم والأدب والفن والعمل الوطني والإنساني، وألهمت إنجازاتهن أجيالًا من بعدهن.','Stories of women whose achievements inspired generations.','Des récits de femmes dont les réalisations ont inspiré des générations.','Storie di donne i cui risultati hanno ispirato generazioni.'],
['التاريخ والحضارات','History and Civilizations','Histoire et civilisations','Storia e civiltà'],
['اقترب من التاريخ عبر حكايات تربط الشخصيات والأحداث بعصرها، وتفصل بين الوقائع والتفسيرات.','Get closer to history through stories that link figures and events to their era and separate facts from interpretations.','Approchez l’histoire à travers des récits qui relient les personnages et les événements à leur époque et distinguent les faits des interprétations.','Avvicinati alla storia attraverso racconti che collegano personaggi ed eventi alla loro epoca e distinguono i fatti dalle interpretazioni.'],
['حكايات عن شخصيات وأماكن وأحداث نفهمها من خلال سياقها ومصادرها.','Stories about figures, places and events understood through their context and sources.','Des histoires sur des personnages, des lieux et des événements compris à travers leur contexte et leurs sources.','Storie su personaggi, luoghi ed eventi compresi attraverso il loro contesto e le loro fonti.'],
['ابن سينا — الشيخ الرئيس','Ibn Sina (Avicenna) — Al-Sheikh Al-Ra’is','Ibn Sina (Avicenne) — Al-Cheikh Ar-Raïs','Ibn Sina (Avicenna) — Al-Sheikh Al-Ra’is'],
['حكاية عالم جمع بين الطب والفلسفة، وترك كتابه «القانون في الطب» أثرًا طويلًا في التعليم الطبي.','The story of a scholar who combined medicine and philosophy, whose book “The Canon of Medicine” left a lasting mark on medical education.','L’histoire d’un savant qui a réuni médecine et philosophie, et dont le livre « Le Canon de la médecine » a durablement marqué l’enseignement médical.','La storia di uno studioso che unì medicina e filosofia e il cui libro «Il Canone della medicina» lasciò un segno duraturo nell’insegnamento medico.'],
['اقرأ الحكاية ←','Read the story →','Lire l’histoire →','Leggi la storia →'],
['رسم توضيحي لكتاب طبي قديم مرتبط بحكاية ابن سينا','Illustration of an ancient medical book linked to the story of Ibn Sina','Illustration d’un ancien livre médical lié à l’histoire d’Ibn Sina','Illustrazione di un antico libro medico legato alla storia di Ibn Sina'],
['أحمد عرابي — حين رفع صوته بالمطالب','Ahmed Urabi — When He Raised His Voice','Ahmed Urabi — Quand il a fait entendre sa voix','Ahmed Urabi — Quando fece sentire la sua voce'],
['حكاية عن مطالب الجيش والثورة العرابية والتحولات التي سبقت الاحتلال البريطاني لمصر سنة 1882.','A story about army demands, the Urabi revolt and the changes that preceded the British occupation of Egypt in 1882.','Un récit sur les revendications de l’armée, la révolte d’Urabi et les changements qui ont précédé l’occupation britannique de l’Égypte en 1882.','Un racconto sulle richieste dell’esercito, la rivolta di Urabi e i cambiamenti che precedettero l’occupazione britannica dell’Egitto nel 1882.'],
['رسم توضيحي لحكاية أحمد عرابي والثورة العرابية','Illustration for the story of Ahmed Urabi and the Urabi revolt','Illustration pour l’histoire d’Ahmed Urabi et de la révolte d’Urabi','Illustrazione della storia di Ahmed Urabi e della rivolta di Urabi'],
['حكاية العالم أحمد زويل','The Story of Scientist Ahmed Zewail','L’histoire du scientifique Ahmed Zewail','La storia dello scienziato Ahmed Zewail'],
['حكاية العالم المصري الحائز على جائزة نوبل في الكيمياء سنة 1999، وكيف ساعدت نبضات الليزر القصيرة جدًا العلماء على مراقبة الذرات أثناء التفاعل الكيميائي.','The story of the Egyptian Nobel Prize winner in Chemistry in 1999, and how ultrashort laser pulses helped scientists observe atoms during chemical reactions.','L’histoire du scientifique égyptien lauréat du prix Nobel de chimie en 1999, et comment les impulsions laser ultracourtes ont aidé les scientifiques à observer les atomes pendant les réactions chimiques.','La storia dello scienziato egiziano vincitore del Nobel per la chimica nel 1999 e di come gli impulsi laser ultrabrevi abbiano aiutato gli scienziati a osservare gli atomi durante le reazioni chimiche.'],
['رسم توضيحي لذرات تتحرك ونبضات ليزر مرتبط بحكاية أحمد زويل','Illustration of moving atoms and laser pulses linked to Ahmed Zewail’s story','Illustration d’atomes en mouvement et d’impulsions laser liée à l’histoire d’Ahmed Zewail','Illustrazione di atomi in movimento e impulsi laser legata alla storia di Ahmed Zewail'],
['☀️ فاتح','☀️ Light','☀️ Clair','☀️ Chiaro'],
['🌙 داكن','🌙 Dark','🌙 Sombre','🌙 Scuro'],
['→ الرئيسية','← Home','← Accueil','← Home'],
['شاركنا حكاية','Share a story with us','Partagez une histoire','Condividi una storia'],
['اكتب حكايتك','Write your story','Écrivez votre histoire','Scrivi la tua storia'],
['اقترح حكاية عن شخصية أثّرت في التاريخ أو وردت في المناهج المصرية. الإرسال لا يعني النشر؛ كل حكاية تُراجع أولًا.','Suggest a story about a figure who influenced history or appears in the Egyptian curricula. Submitting does not mean publishing; every story is reviewed first.','Proposez une histoire sur un personnage qui a marqué l’histoire ou figure dans les programmes égyptiens. Envoyer ne veut pas dire publier ; chaque histoire est d’abord relue.','Proponi una storia su un personaggio che ha influenzato la storia o compare nei programmi egiziani. Inviare non significa pubblicare; ogni storia viene prima rivista.'],
['اختر شخصية وحكِ قصتها بصوتك. الإرسال لا يعني النشر: تُراجع الحقائق والمصادر أولًا، ويُعرض النص عليك قبل أي ترجمة، ولا تُنشر حكاية دون موافقة.','Choose a figure and tell their story in your own voice. Submitting does not mean publishing: facts and sources are reviewed first, the text is shown to you before any translation, and no story is published without approval.','Choisissez un personnage et racontez son histoire avec votre voix. Envoyer ne veut pas dire publier : les faits et les sources sont d’abord vérifiés, le texte vous est présenté avant toute traduction, et aucune histoire n’est publiée sans approbation.','Scegli un personaggio e racconta la sua storia con la tua voce. Inviare non significa pubblicare: fatti e fonti vengono prima verificati, il testo ti viene mostrato prima di ogni traduzione e nessuna storia viene pubblicata senza approvazione.'],
['عن الحكاية','About the story','À propos de l’histoire','Sulla storia'],
['القسم *','Section *','Rubrique *','Sezione *'],
['اختر القسم','Choose the section','Choisissez la rubrique','Scegli la sezione'],
['حكايات أكتوبر 1973','October 1973 Stories','Récits d’octobre 1973','Storie di ottobre 1973'],
['شخصيات المناهج المصرية','Egyptian Curriculum Figures','Figures des programmes égyptiens','Personaggi dei programmi egiziani'],
['اقتراح آخر','Another suggestion','Autre proposition','Un altro suggerimento'],
['الشخصية أو الموضوع *','Figure or topic *','Personnage ou sujet *','Personaggio o argomento *'],
['مثال: أحمد زويل','Example: Ahmed Zewail','Exemple : Ahmed Zewail','Esempio: Ahmed Zewail'],
['المرحلة *','Stage *','Cycle *','Ciclo *'],
['اختر المرحلة','Choose the stage','Choisissez le cycle','Scegli il ciclo'],
['الابتدائية','Primary','Primaire','Primaria'],
['الإعدادية','Preparatory','Collège','Media'],
['الثانوية','Secondary','Lycée','Superiore'],
['الصف *','Grade *','Classe *','Classe *'],
['اختر الصف','Choose the grade','Choisissez la classe','Scegli la classe'],
['المادة أو الكتاب','Subject or book','Matière ou manuel','Materia o libro'],
['اختياري، حسب ورود الشخصية فعلًا في الكتاب','Optional, according to where the figure actually appears in the book','Facultatif, selon la présence réelle du personnage dans le manuel','Facoltativo, in base a dove il personaggio compare davvero nel libro'],
['مثال: الدراسات الاجتماعية','Example: Social studies','Exemple : études sociales','Esempio: studi sociali'],
['عنوان الحكاية *','Story title *','Titre de l’histoire *','Titolo della storia *'],
['عنوان فرعي','Subtitle','Sous-titre','Sottotitolo'],
['اختياري','Optional','Facultatif','Facoltativo'],
['الحكاية بصوتك *','Your story in your own voice *','Votre histoire avec votre voix *','La tua storia con la tua voce *'],
['اكتبها بأسلوبك وكلماتك، 50 حرفًا على الأقل. افصل الفقرات بسطر فارغ.','Write it in your own style and words, at least 50 characters. Separate paragraphs with a blank line.','Écrivez-la à votre façon, avec vos mots, au moins 50 caractères. Séparez les paragraphes par une ligne vide.','Scrivila a modo tuo, con parole tue, almeno 50 caratteri. Separa i paragrafi con una riga vuota.'],
['المصادر','Sources','Sources','Fonti'],
['اختياري لكنه مهم: كتب أو مواقع اعتمدت عليها، سطر لكل مصدر','Optional but important: books or sites you relied on, one line per source','Facultatif mais important : livres ou sites utilisés, une ligne par source','Facoltativo ma importante: libri o siti che hai usato, una riga per fonte'],
['الصور','Images','Images','Immagini'],
['اختياري: هل عندك صورة مناسبة؟ اذكر مصدرها وحقوق استخدامها (لا ترسل صورًا هنا)','Optional: do you have a suitable image? State its source and usage rights (do not send images here)','Facultatif : avez-vous une image adaptée ? Indiquez sa source et ses droits d’utilisation (n’envoyez pas d’images ici)','Facoltativo: hai un’immagine adatta? Indica la fonte e i diritti d’uso (non inviare immagini qui)'],
['عن الراوي','About the narrator','À propos du narrateur','Sul narratore'],
['اسم الراوي *','Narrator’s name *','Nom du narrateur *','Nome del narratore *'],
['الاسم الأول أو لقب فقط، دون اسم العائلة أو المدرسة','First name or nickname only, without family name or school','Prénom ou surnom uniquement, sans nom de famille ni école','Solo nome o soprannome, senza cognome né scuola'],
['الصف الدراسي للراوي','Narrator’s school grade','Classe du narrateur','Classe del narratore'],
['مثال: الصف الأول الإعدادي','Example: 1st Year of Preparatory School','Exemple : 1re année du collège','Esempio: 1ª media'],
['لا تملأ هذا الحقل','Do not fill in this field','Ne remplissez pas ce champ','Non compilare questo campo'],
['أوافق أنا (أو ولي الأمر إن كنت دون 18 سنة) على عرض الاسم الأول فقط والصف بعد المراجعة، وأفهم أن الإرسال لا يعني النشر. *','I (or my parent or guardian if I am under 18) agree to show only my first name and grade after review, and I understand that submitting does not mean publishing. *','J’accepte (ou mon parent ou tuteur si j’ai moins de 18 ans) que seuls mon prénom et ma classe soient affichés après relecture, et je comprends qu’envoyer ne veut pas dire publier. *','Accetto (o lo fa il mio genitore o tutore se ho meno di 18 anni) che vengano mostrati solo il nome e la classe dopo la revisione, e capisco che inviare non significa pubblicare. *'],
['إرسال الحكاية','Submit the story','Envoyer l’histoire','Invia la storia'],
['الإرسال بالعربية. لا تكتب بيانات تواصل أو أسماء كاملة.','Submissions are in Arabic. Do not write contact details or full names.','L’envoi se fait en arabe. N’écrivez pas de coordonnées ni de noms complets.','L’invio è in arabo. Non scrivere dati di contatto né nomi completi.'],
['وصلت حكايتك 🎉','Your story has arrived 🎉','Votre histoire est bien arrivée 🎉','La tua storia è arrivata 🎉'],
['شكرًا لك. ستُراجع الحقائق والمصادر أولًا، ولن تُنشر قبل الموافقة.','Thank you. Facts and sources will be reviewed first, and it will not be published before approval.','Merci. Les faits et les sources seront d’abord vérifiés, et elle ne sera pas publiée avant approbation.','Grazie. Fatti e fonti verranno prima verificati e non sarà pubblicata prima dell’approvazione.'],
['اكتب حكاية أخرى','Write another story','Écrire une autre histoire','Scrivi un’altra storia'],
['→ العودة إلى الرئيسية','← Back to home','← Retour à l’accueil','← Torna alla home'],
['أكمل الحقول المطلوبة: القسم والشخصية والعنوان واسم الراوي.','Complete the required fields: section, figure, title and narrator’s name.','Remplissez les champs obligatoires : rubrique, personnage, titre et nom du narrateur.','Compila i campi obbligatori: sezione, personaggio, titolo e nome del narratore.'],
['اختر المرحلة والصف لشخصيات المناهج.','Choose the stage and grade for curriculum figures.','Choisissez le cycle et la classe pour les personnages des programmes.','Scegli ciclo e classe per i personaggi dei programmi.'],
['الحكاية قصيرة؛ اكتب 50 حرفًا على الأقل.','The story is too short; write at least 50 characters.','L’histoire est trop courte ; écrivez au moins 50 caractères.','La storia è troppo breve; scrivi almeno 50 caratteri.'],
['لا بد من الموافقة على عرض الاسم الأول والصف بعد المراجعة.','You must agree to show the first name and grade after review.','Vous devez accepter l’affichage du prénom et de la classe après relecture.','Devi accettare che nome e classe vengano mostrati dopo la revisione.'],
['انتظر دقيقة قبل إرسال حكاية أخرى.','Wait a minute before sending another story.','Attendez une minute avant d’envoyer une autre histoire.','Attendi un minuto prima di inviare un’altra storia.'],
['خدمة الإرسال لم تُفعّل بعد. حاول لاحقًا.','The submission service is not active yet. Please try later.','Le service d’envoi n’est pas encore activé. Réessayez plus tard.','Il servizio di invio non è ancora attivo. Riprova più tardi.'],
['تعذر الاتصال. تأكد من الإنترنت وحاول مرة أخرى.','Connection failed. Check your internet and try again.','Connexion impossible. Vérifiez votre connexion Internet et réessayez.','Connessione non riuscita. Controlla la connessione a Internet e riprova.'],
['قسم من خالدون عبر التاريخ','A section of Immortals Through History','Une rubrique d’Immortels à travers l’histoire','Una sezione di Immortali attraverso la storia','Ein Bereich von Unsterbliche durch die Geschichte'],
['حكايات موثقة تُضاف بعد مراجعة المحتوى والمصادر.','Documented stories are added after content and sources are reviewed.','Les récits documentés sont ajoutés après vérification du contenu et des sources.','Le storie documentate vengono aggiunte dopo la revisione dei contenuti e delle fonti.','Dokumentierte Geschichten werden nach Prüfung der Inhalte und Quellen hinzugefügt.'],
['نساء خالدات | خالدون عبر التاريخ','Women Who Made History | Immortals Through History','Femmes qui ont marqué l’histoire | Immortels à travers l’histoire','Donne che hanno fatto la storia | Immortali attraverso la storia','Frauen, die Geschichte schrieben | Unsterbliche durch die Geschichte'],
['وجوه من التاريخ','Faces from History','Visages de l’histoire','Volti della storia','Gesichter der Geschichte'],
['صور تاريخية وقطع أثرية موثقة، تمهيدًا لإضافة الحكايات بعد مراجعتها واعتمادها.','Documented historical images and artifacts, ahead of adding stories after review and approval.','Images historiques et objets archéologiques documentés, en attendant l’ajout de récits après vérification et approbation.','Immagini storiche e reperti documentati, in attesa di aggiungere racconti dopo revisione e approvazione.','Dokumentierte historische Bilder und Artefakte; Geschichten werden nach Prüfung und Freigabe ergänzt.'],
['الملكة نفرتيتي','Queen Nefertiti','La reine Néfertiti','La regina Nefertiti','Königin Nofretete'],
['رأس تمثال من مجموعة متحف برلين المصري ومجموعة البرديات.','A sculpted head from the Egyptian Museum and Papyrus Collection in Berlin.','Tête sculptée provenant de la collection du musée égyptien et de la collection de papyrus de Berlin.','Testa scolpita dalla collezione del Museo Egizio e della collezione di papiri di Berlino.','Ein Statuenkopf aus der Sammlung des Ägyptischen Museums und der Papyrussammlung Berlin.'],
['الصورة: متاحف برلين / Sandra Steiß، عبر Wikimedia Commons — CC BY-SA 4.0','Image: Berlin State Museums / Sandra Steiß, via Wikimedia Commons — CC BY-SA 4.0','Image : Musées d’État de Berlin / Sandra Steiß, via Wikimedia Commons — CC BY-SA 4.0','Immagine: Musei statali di Berlino / Sandra Steiß, via Wikimedia Commons — CC BY-SA 4.0','Bild: Staatliche Museen zu Berlin / Sandra Steiß, über Wikimedia Commons — CC BY-SA 4.0'],
['الملكة حتشبسوت','Queen Hatshepsut','La reine Hatchepsout','La regina Hatshepsut','Königin Hatschepsut'],
['تمثال أثري لواحدة من أشهر حاكمات مصر القديمة.','An ancient statue of one of the best-known rulers of ancient Egypt.','Statue antique de l’une des souveraines les plus célèbres de l’Égypte ancienne.','Statua antica di una delle più celebri sovrane dell’antico Egitto.','Eine antike Statue einer der bekanntesten Herrscherinnen des alten Ägypten.'],
['المصدر: متحف المتروبوليتان عبر Wikimedia Commons — CC0','Source: The Metropolitan Museum of Art via Wikimedia Commons — CC0','Source : Metropolitan Museum of Art via Wikimedia Commons — CC0','Fonte: Metropolitan Museum of Art tramite Wikimedia Commons — CC0','Quelle: Metropolitan Museum of Art über Wikimedia Commons — CC0'],
['كليوباترا السابعة','Cleopatra VII','Cléopâtre VII','Cleopatra VII','Kleopatra VII.'],
['لوحة جدارية قديمة يُحتمل أنها تصور كليوباترا؛ ليست صورة مؤكدة لملامحها.','An ancient wall painting that may depict Cleopatra; it is not a confirmed likeness.','Une peinture murale antique qui pourrait représenter Cléopâtre ; il ne s’agit pas d’un portrait confirmé.','Un’antica pittura murale che potrebbe raffigurare Cleopatra; non è un ritratto certo.','Ein antikes Wandgemälde, das möglicherweise Kleopatra zeigt; es ist kein gesichertes Porträt.'],
['المصدر: Wikimedia Commons؛ الصورة CC BY 2.0 والعمل الفني الأصلي من الملكية العامة','Source: Wikimedia Commons; image CC BY 2.0; original artwork is in the public domain','Source : Wikimedia Commons ; image sous CC BY 2.0 ; l’œuvre originale est dans le domaine public','Fonte: Wikimedia Commons; immagine CC BY 2.0; l’opera originale è di pubblico dominio','Quelle: Wikimedia Commons; Bild CC BY 2.0; das ursprüngliche Kunstwerk ist gemeinfrei']
];
var D={};R.forEach(function(r){D[r[0]]=r.slice(1)});
var O={'الأول':1,'الثاني':2,'الثالث':3,'الرابع':4,'الخامس':5,'السادس':6};
var ER=['Could not send right now ({c}). Check the fields and try again.','Envoi impossible pour le moment ({c}). Vérifiez les champs et réessayez.','Impossibile inviare ora ({c}). Controlla i campi e riprova.','Senden ist gerade nicht möglich ({c}). Prüfe die Felder und versuche es erneut.'];
function tr(s,i){
 var z=i===4&&(window.KH_LANG&&window.KH_LANG.translate?window.KH_LANG.translate('de',s):'');if(z)return z;
 var d=D[s],m;if(d)return d[i-1]||(i===4?d[0]:s);
 m=s.match(/^الصف (\S+)$/);if(m&&O[m[1]])return ['Grade ','Classe ','Classe ','Klasse '][i-1]+O[m[1]];
 m=s.match(/^تعذر الإرسال الآن \((\d+)\)\. راجع الحقول وحاول مرة أخرى\.$/);if(m)return ER[i-1].replace('{c}',m[1]);
 return s}
function get(){var s='ar';try{s=localStorage.getItem('kh-lang')||localStorage.getItem('lang')||'ar'}catch(e){}var i=LG.indexOf(s);return i<0?0:i}
function one(n){
 if(n.__o===undefined)n.__o=n.data;
 var t=n.__o.trim();if(!t)return;
 n.data=l?n.__o.replace(t,tr(t,l)):n.__o}
function ap(r){
 if(r.nodeType===3){one(r);return}
 if(r.nodeType!==1)return;
 var w=document.createTreeWalker(r,4,{acceptNode:function(n){var p=n.parentNode.nodeName;return p==='SCRIPT'||p==='STYLE'?2:1}}),n;
 while(n=w.nextNode())one(n)}
var AT=['placeholder','aria-label','alt'];
function attrs(r){
 if(r.nodeType!==1)return;
 var els=[r].concat([].slice.call(r.querySelectorAll('[placeholder],[aria-label],[alt]')));
 els.forEach(function(el){AT.forEach(function(a){
  if(!el.hasAttribute(a))return;
  var k='__a_'+a;if(el[k]===undefined)el[k]=el.getAttribute(a);
  var tt=el[k].trim(),t=l?tr(tt,l):tt;
  el.setAttribute(a,(l&&t!==tt)?t:el[k])})})}
var T0=document.title,md=document.querySelector('meta[name=description]'),M0=md?md.content:'';
function sl(i){
 l=i;de.lang=LG[i];de.dir=i?'ltr':'rtl';
 ap(document.body);attrs(document.body);
 document.title=i?T0.split(' | ').map(function(p){return tr(p,i)}).join(' | '):T0;
 if(md)md.content=i?tr(M0,i):M0}
var st=document.createElement('style');
st.textContent='html:not([lang=ar]) .hero:after{content:none!important}';
document.head.appendChild(st);
new MutationObserver(function(ms){if(!l)return;ms.forEach(function(m){[].forEach.call(m.addedNodes,function(n){ap(n);attrs(n)})})}).observe(document.body,{childList:true,subtree:true});
var si=get();if(si>0)sl(si);
})();
