#!/usr/bin/env python3
"""
Khaledoon — one-shot patch for the remaining story packages (run from the repo root):

    python3 apply_story_trims.py          # edits stories/*/*/story.json in place
    node rebuild/validate-story.mjs ...   # then run the repo's own validator / tests

What it does (and nothing else):
  1. Replaces the long process-style history_note / images_note with short reader-facing notes (ar/en/fr/it/de)
     for stories 007, 009, 013, 014, 015.
  2. Trims the sources list: 007 -> 5, 015 -> 5, 016 -> 3 (013 keeps its 6: a repo test expects 6) (image/licence pages are already credited in each image).
  3. Sets design.accent to the section colour used by rebuild/reader.js (SECTION_PALETTE) for every story.
  4. Fixes the Italian typo in 008 ("si spedò" -> "si spostò").
Each edit asserts that the target exists, so a story that already changed upstream fails loudly instead of being overwritten.
"""
import json, sys, pathlib

ROOT = pathlib.Path('stories')
PALETTE = {'history':'#d5b7ff','science':'#8ad9e8','women':'#d78bb2','people':'#e2b36d','islamic':'#78c59a'}
L = ['ar','en','fr','it','de']

NOTES = {
 'science/007': {
  'history_note': {
   'ar': "تختلف المصادر في مكان نشأته (الإسكندرية في موقع نوبل ودسوق في مصادر أخرى)، لذلك لم تذكره الحكاية. وتفاصيل مكتبة الإسكندرية مصدرها تقارير صحفية مصرية وليس موقع المكتبة نفسه.",
   'en': "Sources differ on where he grew up (Alexandria on the Nobel site, Desouk in other sources), so the story does not state it. The Bibliotheca Alexandrina details come from Egyptian press reports, not from the library’s own website.",
   'fr': "Les sources divergent sur son lieu de grandissement (Alexandrie sur le site Nobel, Désouk ailleurs) ; le récit ne le précise donc pas. Les détails sur la Bibliotheca Alexandrina proviennent de la presse égyptienne et non du site de la bibliothèque.",
   'it': "Le fonti divergono sul luogo in cui crebbe (Alessandria sul sito Nobel, Desuk altrove), quindi la storia non lo indica. I dettagli sulla Bibliotheca Alexandrina provengono dalla stampa egiziana, non dal sito della biblioteca.",
   'de': "Die Quellen nennen unterschiedliche Orte, an denen er aufwuchs (Alexandria auf der Nobel-Seite, Desuk in anderen Quellen); die Geschichte nennt ihn daher nicht. Die Angaben zur Bibliotheca Alexandrina stammen aus ägyptischen Pressemeldungen, nicht von der Bibliothek selbst."},
  'images_note': {
   'ar': "الصور داخل الحكاية رسوم توضيحية أصلية وليست صورًا أرشيفية أو علمية حقيقية.",
   'en': "The images in this story are original illustrations, not archival photographs or real scientific captures.",
   'fr': "Les images de ce récit sont des illustrations originales, et non des photographies d’archives ni de vraies prises de vue scientifiques.",
   'it': "Le immagini di questa storia sono illustrazioni originali, non fotografie d’archivio né vere riprese scientifiche.",
   'de': "Die Bilder dieser Geschichte sind Originalillustrationen, keine Archivfotos und keine echten wissenschaftlichen Aufnahmen."}},
 'people/009': {
  'history_note': {
   'ar': "وُلد محفوظ في حي الجمالية بالقاهرة في 11 ديسمبر 1911 وتوفي في 30 أغسطس 2006، ونال جائزة نوبل في الأدب عام 1988 وفق السيرة الرسمية لنوبل. وتختلف الدراسات في تقسيم مراحله الأدبية، والملخصات هنا صياغة تحريرية وليست اقتباسات من محفوظ.",
   'en': "Mahfouz was born in Gamaliya, Cairo, on 11 December 1911, died on 30 August 2006, and won the Nobel Prize in Literature in 1988, according to the official Nobel biography. Scholars divide his career into periods differently, and the summaries here are editorial writing, not quotations from Mahfouz.",
   'fr': "Mahfouz est né à Gamaliya, au Caire, le 11 décembre 1911, est mort le 30 août 2006 et a reçu le prix Nobel de littérature en 1988, selon la biographie officielle du Nobel. Les spécialistes divisent sa carrière différemment, et les résumés ici sont rédigés pour ce récit, sans citations de Mahfouz.",
   'it': "Mahfouz nacque a Gamaliya, al Cairo, l’11 dicembre 1911, morì il 30 agosto 2006 e vinse il Nobel per la letteratura nel 1988, secondo la biografia ufficiale del Nobel. Gli studiosi dividono in modo diverso la sua carriera, e i riassunti qui sono testi redazionali, non citazioni di Mahfouz.",
   'de': "Mahfus wurde laut offizieller Nobelpreis-Biografie am 11. Dezember 1911 in Gamaliya in Kairo geboren, starb am 30. August 2006 und erhielt 1988 den Literaturnobelpreis. Die Forschung gliedert sein Schaffen unterschiedlich; die Zusammenfassungen hier sind redaktionelle Texte, keine Zitate von Mahfus."},
  'images_note': {
   'ar': "الصور الفوتوغرافية تاريخية لنجيب محفوظ، وصفحات ويكيميديا كومنز تعرض مصدر كل صورة وترخيصها. لم تُدرج أغلفة كتب ولا مشاهد أفلام.",
   'en': "The photographs are historical photographs of Naguib Mahfouz; each Wikimedia Commons page shows the source and licence. No book covers or film stills are included.",
   'fr': "Les photographies sont des photographies historiques de Naguib Mahfouz ; chaque page Wikimedia Commons indique la source et la licence. Aucune couverture de livre ni image de film n’est incluse.",
   'it': "Le fotografie sono fotografie storiche di Naguib Mahfouz; ogni pagina di Wikimedia Commons indica fonte e licenza. Non sono incluse copertine di libri né fotogrammi di film.",
   'de': "Die Fotos sind historische Aufnahmen von Nagib Mahfus; die jeweilige Wikimedia-Commons-Seite nennt Quelle und Lizenz. Buchcover und Filmszenen sind nicht enthalten."}},
 'women/013': {
  'history_note': {
   'ar': "يختلف الباحثون في سبب محو صور حتشبسوت وأسمائها من بعض المعابد، ولا يوجد تفسير نهائي واحد. وموقع بلاد بونت ما زال موضع نقاش، وتضعه قراءات كثيرة في القرن الأفريقي. أما ما نُشر صحفيًا عن احتمال السكري والسرطان بعد فحص مومياء حتشبسوت عام 2007 فليس تشخيصًا نهائيًا.",
   'en': "Scholars disagree about why Hatshepsut’s images and names were erased from some temples, and there is no single final explanation. The location of Punt is still debated; many readings place it in the Horn of Africa. Press reports about diabetes or cancer after the 2007 mummy examinations are not a definitive diagnosis.",
   'fr': "Les spécialistes ne s’accordent pas sur la raison pour laquelle les images et le nom d’Hatchepsout ont été effacés de certains temples ; il n’existe pas d’explication unique. L’emplacement du Pount reste débattu et de nombreuses lectures le situent dans la Corne de l’Afrique. Ce que la presse a rapporté sur le diabète ou le cancer après l’examen de la momie en 2007 n’est pas un diagnostic définitif.",
   'it': "Gli studiosi non concordano sul motivo per cui immagini e nome di Hatshepsut furono cancellati da alcuni templi; non esiste una spiegazione unica. La posizione di Punt è ancora dibattuta e molte letture la collocano nel Corno d’Africa. Quanto riferito dalla stampa su diabete o cancro dopo l’esame della mummia nel 2007 non è una diagnosi definitiva.",
   'de': "Die Forschung ist sich nicht einig, warum Bilder und Namen Hatschepsuts in einigen Tempeln getilgt wurden; eine einzige endgültige Erklärung gibt es nicht. Die Lage von Punt wird weiter diskutiert; viele Deutungen sehen sie am Horn von Afrika. Pressemeldungen über Diabetes oder Krebs nach den Mumienuntersuchungen 2007 sind keine gesicherte Diagnose."},
  'images_note': {
   'ar': "صور المتروبوليتان ضمن الملكية العامة (CC0)، وصورة معبد الدير البحري بترخيص CC BY 4.0؛ أما الغلاف والرسوم فأصلية وليست صورًا أثرية.",
   'en': "The Metropolitan Museum images are public domain (CC0) and the Deir el-Bahari panorama is CC BY 4.0; the cover and illustrations are original artwork, not archaeological photographs.",
   'fr': "Les images du Metropolitan Museum sont dans le domaine public (CC0) et le panorama de Deir el-Bahari est sous licence CC BY 4.0 ; la couverture et les illustrations sont originales, et non des photographies archéologiques.",
   'it': "Le immagini del Metropolitan Museum sono di pubblico dominio (CC0) e il panorama di Deir el-Bahari ha licenza CC BY 4.0; copertina e illustrazioni sono opere originali, non fotografie archeologiche.",
   'de': "Die Bilder des Metropolitan Museum sind gemeinfrei (CC0), das Panorama von Deir el-Bahari steht unter CC BY 4.0; Titelbild und Illustrationen sind Originalgrafiken, keine archäologischen Fotos."}},
 'history/014': {
  'history_note': {
   'ar': "هذه الحكاية عن أبي بكر محمد بن العباس الخوارزمي، الشاعر والكاتب (نحو 934–993م)، ولا ينبغي الخلط بينه وبين الرياضي محمد بن موسى الخوارزمي. والتواريخ الميلادية تقريبية لاختلاف المراجع في تحويل التواريخ الهجرية، وتفاصيل سجنه وعلاقته بوالي سجستان مصدرها كتب التراجم.",
   'en': "This story is about Abu Bakr Muhammad ibn al-Abbas al-Khwarizmi, the poet and writer (about 934–993 CE), not the mathematician Muhammad ibn Musa al-Khwarizmi. Gregorian dates are approximate because references convert Hijri dates differently, and the details of his imprisonment and his relationship with the governor of Sijistan come from biographical dictionaries.",
   'fr': "Ce récit concerne Abou Bakr Muhammad ibn al-Abbas al-Khwarizmi, poète et écrivain (vers 934–993), et non le mathématicien Muhammad ibn Musa al-Khwarizmi. Les dates grégoriennes sont approximatives, car les références convertissent différemment les dates hégiriennes ; les détails de son emprisonnement et de ses rapports avec le gouverneur du Sijistan viennent de dictionnaires biographiques.",
   'it': "Questa storia riguarda Abu Bakr Muhammad ibn al-Abbas al-Khwarizmi, poeta e scrittore (circa 934–993), e non il matematico Muhammad ibn Musa al-Khwarizmi. Le date gregoriane sono approssimative perché le fonti convertono diversamente le date egiriane; i dettagli sulla sua prigionia e sul rapporto con il governatore del Sijistan provengono da dizionari biografici.",
   'de': "Diese Geschichte handelt von Abu Bakr Muhammad ibn al-Abbas al-Chwarizmi, dem Dichter und Schriftsteller (etwa 934–993), nicht vom Mathematiker Muhammad ibn Musa al-Chwarizmi. Die gregorianischen Daten sind ungefähr, da Nachschlagewerke Hidschra-Daten unterschiedlich umrechnen; die Einzelheiten seiner Haft und seines Verhältnisses zum Statthalter von Sidschistan stammen aus biografischen Lexika."},
  'images_note': {
   'ar': "الغلاف والرسمان من إنتاج المشروع، وليسوا صورًا تاريخية أو بورتريه موثقًا. ولم تُدرج صور صفحات طبعة 1880 قبل التحقق من حقوق إعادة استخدامها.",
   'en': "The cover and the two illustrations were created for this project; they are not historical photographs or verified portraits. Scans from the 1880 edition were not included before their rights could be verified.",
   'fr': "La couverture et les deux illustrations ont été créées pour ce projet ; ce ne sont ni des photographies historiques ni des portraits vérifiés. Les pages de l’édition de 1880 n’ont pas été incluses avant vérification de leurs droits.",
   'it': "La copertina e le due illustrazioni sono state create per questo progetto; non sono fotografie storiche né ritratti verificati. Le pagine dell’edizione del 1880 non sono state incluse prima di verificarne i diritti.",
   'de': "Titelbild und die beiden Illustrationen wurden für dieses Projekt geschaffen; sie sind keine historischen Fotos und keine gesicherten Porträts. Seiten der Ausgabe von 1880 wurden erst nach einer Rechteprüfung aufgenommen und sind noch nicht enthalten."}},
 'science/015': {
  'history_note': {
   'ar': "تذكر مصادر سيرة مجدي يعقوب أنه وُلد في بلبيس بمحافظة الشرقية في 16 نوفمبر 1935، وليس في أسوان كما ورد في النص الأصلي، فصُححت المعلومة. وتختلف المصادر في بعض تفاصيل طفولته، لذلك صيغت هذه الجزئية بحذر.",
   'en': "Biographical sources place Magdi Yacoub’s birth in Belbeis, Sharqia, on 16 November 1935, not in Aswan as in the original text, so the story corrects it. Sources differ on some details of his childhood, which are described cautiously.",
   'fr': "Les sources biographiques situent la naissance de Magdi Yacoub à Belbeis, dans le Charqiya, le 16 novembre 1935, et non à Assouan comme dans le texte d’origine ; le récit corrige donc cette information. Les sources divergent sur certains détails de son enfance, présentés avec prudence.",
   'it': "Le fonti biografiche collocano la nascita di Magdi Yacoub a Belbeis, nel Sharqia, il 16 novembre 1935, non ad Assuan come nel testo originale; la storia corregge quindi l’informazione. Le fonti divergono su alcuni dettagli dell’infanzia, presentati con cautela.",
   'de': "Biografische Quellen nennen Belbeis in Scharkia als Geburtsort von Magdi Yacoub (16. November 1935), nicht Assuan wie im Originaltext; die Geschichte korrigiert dies. Bei einigen Details seiner Kindheit unterscheiden sich die Quellen; sie werden vorsichtig dargestellt."},
  'images_note': {
   'ar': "الصورتان من ويكيميديا كومنز بترخيصي CC BY-SA 3.0 وCC BY-SA 4.0، مع وجوب الإسناد.",
   'en': "Both photographs are from Wikimedia Commons under CC BY-SA 3.0 and CC BY-SA 4.0, with attribution required.",
   'fr': "Les deux photographies proviennent de Wikimedia Commons sous licences CC BY-SA 3.0 et CC BY-SA 4.0, avec attribution obligatoire.",
   'it': "Le due fotografie provengono da Wikimedia Commons con licenze CC BY-SA 3.0 e CC BY-SA 4.0, con obbligo di attribuzione.",
   'de': "Beide Fotos stammen von Wikimedia Commons unter CC BY-SA 3.0 und CC BY-SA 4.0; eine Namensnennung ist erforderlich."}},
}
KEEP_SOURCES = {'science/007':[0,1,2,4,6], 'science/015':[0,1,2,3,4], 'science/016':[0,1,3]}

def main():
    stories = sorted(p for p in ROOT.glob('*/*/story.json') if p.parent.parent.name in PALETTE)
    for p in stories:
        key = f'{p.parent.parent.name}/{p.parent.name}'
        raw = p.read_text(encoding='utf-8'); d = json.loads(raw)
        changed = False
        if key in NOTES:
            for field, per in NOTES[key].items():
                for l in L:
                    assert l in d['i18n'] and field in d['i18n'][l], (key, l, field)
                    d['i18n'][l][field] = per[l]
            changed = True
        if key in KEEP_SOURCES:
            idx = KEEP_SOURCES[key]; assert max(idx) < len(d['sources']), key
            d['sources'] = [d['sources'][i] for i in idx]; changed = True
        acc = PALETTE[p.parent.parent.name]
        if d['design'].get('accent') != acc:
            d['design']['accent'] = acc; changed = True
        out = json.dumps(d, indent=2, ensure_ascii=False) + ('\n' if raw.endswith('\n') else '')
        if key == 'people/008':
            assert 'si spedò' in out, 'already fixed?'
            out = out.replace('si spedò', 'si spostò'); changed = True
        if changed and out != raw:
            p.write_text(out, encoding='utf-8'); print('patched', key)
    print('done')

if __name__ == '__main__':
    main()
