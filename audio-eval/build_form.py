"""Builds audio-eval-listening-form.xlsx (blind listening form for engines A-D).

Run: python audio-eval/build_form.py
Then recalculate formulas (LibreOffice) so the summary sheet has cached values.
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L

F = "Arial"
base = Font(name=F, size=11)
bold = Font(name=F, size=11, bold=True)
blue = Font(name=F, size=11, color="0000FF")
hdr_fill = PatternFill("solid", fgColor="D9E1F2")
inp_fill = PatternFill("solid", fgColor="FFF9C4")
thin = Side(style="thin", color="999999")
box = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical="top", horizontal="right")
center = Alignment(wrap_text=True, vertical="center", horizontal="center")

sentences = [
 ("أنا كارما، ولما سمعت حكاية الدكتور مَجْدِي يَعْقُوب، فكرت في حاجة مهمة: إزاي طفل بيحب يساعد الناس ممكن يكبر ويبقى طبيبًا ينقذ حياة أطفال كتير؟", "اسم علم، عامية"),
 ("يعني مَرْكَز أسوان مش بس بيعالج المرضى؟", "اسم علم، عامية"),
 ("بالضبط. المَرْكَز بيقدّم الرعاية الطبية، ويدرّب الأطباء والممرضين، ويدعم البحث العلمي.", "عامية"),
 ("كده الخبرة اللي بيكتسبها الفريق ممكن تساعد مرضى تانيين كمان، مش بس الشخص اللي بيتعالج النهارده.", "عامية"),
 ("وُلِدَ مَجْدِي يَعْقُوب في السادس عشر من نوفمبر سنة ألف وتسعمية خمسة وتلاتين، بمدينة بِلْبِيس بمحافظة الشَّرْقِيَّة في مصر.", "اسم علم، رقم"),
 ("ومنذ طفولته، تعرّف إلى عالم الطب من خلال والده الطبيب، ثم اختار أن يجعل علمه وعمله وسيلة لمساعدة المرضى.", "ضابط (فصحى بلا أسماء)"),
 ("درس الطب في جامعة القاهرة وتخرج عام ألف وتسعمية سبعة وخمسين، ثم سافر إلى بريطانيا عام ألف وتسعمية اتنين وستين لمواصلة التدريب والعمل.", "اسم علم، رقم"),
 ("ومع مرور السنوات، أصبح جراحًا بارزًا متخصصًا في جراحة القلب والصدر، وعمل في مستشفيات بريطانية منها مستشفى هارفيلد.", "اسم علم، أجنبي"),
 ("وساعد في تطوير عمليات لعلاج أمراض القلب المعقدة، ومنها بعض العيوب الخِلقية التي يولد بها الأطفال.", "مصطلح طبي (فصحى)"),
]
engines = ["A", "B", "C", "D"]
FIRST, LAST = 6, 6 + len(sentences) - 1

wb = Workbook()
ws0 = wb.active; ws0.title = "تعليمات"
ws0.sheet_view.rightToLeft = True
rows = [
 ("كيف تملأ الاستمارة", True),
 ("1) استمع لكل تسجيل (A وB وC وD) جملة بجملة. لا تعرف أي محرك خلف أي حرف؛ المفتاح يُكشف بعد تسليم درجاتك.", False),
 ("2) في ورقة «استمارة السماع» املأ الخلايا الصفراء فقط.", False),
 ("3) «خطأ نطق»: اكتب الكلمة التي نُطقت خطأ، ويمكن كتابة أكثر من كلمة. اتركها فارغة إن لم تسمع خطأ.", False),
 ("4) «طبيعية» و«ثبات الشخصية»: رقم من 1 (سيئ) إلى 5 (ممتاز). تُترك فارغة إن لم يوجد تسجيل لهذا الحرف.", False),
 ("5) ورقة «الملخص» تحسب كل شيء تلقائيًا؛ عدّل حدّي الأسماء والأرقام (الخليتان الزرقاوان) فقط.", False),
 ("", False),
 ("مثال على التعبئة (للتوضيح فقط، لا تنقله):", True),
 ("الجملة 5 / تسجيل A / خطأ نطق: «بلبيس» (نُطقت بلبايس) / طبيعية: 3 / ثبات الشخصية: 4", False),
]
for i, (t, b) in enumerate(rows, 1):
    c = ws0.cell(row=i, column=1, value=t); c.font = bold if b else base; c.alignment = wrap
ws0.column_dimensions["A"].width = 100

ws = wb.create_sheet("استمارة السماع")
ws.sheet_view.rightToLeft = True
ws["A1"] = "استمارة السماع: نص المقارنة الثابت (حكاية مجدي يعقوب)"; ws["A1"].font = Font(name=F, size=13, bold=True)
ws["A2"] = "املأ الخلايا الصفراء فقط. الأحرف A–D تسجيلات مجهولة المصدر."; ws["A2"].font = base
for j, h in enumerate(["#", "الجملة", "تختبر"], 1):
    ws.cell(row=5, column=j, value=h)
for k, e in enumerate(engines):
    c0 = 4 + k * 3
    ws.cell(row=4, column=c0, value=f"تسجيل {e}")
    ws.merge_cells(start_row=4, start_column=c0, end_row=4, end_column=c0 + 2)
    ws.cell(row=5, column=c0, value="خطأ نطق (الكلمة)")
    ws.cell(row=5, column=c0 + 1, value="طبيعية 1–5")
    ws.cell(row=5, column=c0 + 2, value="ثبات الشخصية 1–5")
for col in range(1, 4 + 3 * len(engines)):
    for r in (4, 5):
        c = ws.cell(row=r, column=col); c.font = bold; c.fill = hdr_fill; c.alignment = center; c.border = box
dv = DataValidation(type="whole", operator="between", formula1="1", formula2="5", allow_blank=True,
                    showErrorMessage=True, errorTitle="قيمة غير صالحة", error="أدخل رقمًا صحيحًا من 1 إلى 5")
ws.add_data_validation(dv)
for i, (txt, cat) in enumerate(sentences):
    r = FIRST + i
    ws.cell(row=r, column=1, value=i + 1)
    ws.cell(row=r, column=2, value=txt)
    ws.cell(row=r, column=3, value=cat)
    for col in range(1, 4):
        c = ws.cell(row=r, column=col); c.font = base; c.alignment = wrap; c.border = box
    for k in range(len(engines)):
        c0 = 4 + k * 3
        for off in range(3):
            c = ws.cell(row=r, column=c0 + off); c.fill = inp_fill; c.border = box; c.font = blue; c.alignment = center
            if off:
                dv.add(c)
    ws.row_dimensions[r].height = 62
ws.column_dimensions["A"].width = 5
ws.column_dimensions["B"].width = 55
ws.column_dimensions["C"].width = 16
for k in range(len(engines)):
    c0 = 4 + k * 3
    ws.column_dimensions[L(c0)].width = 18
    ws.column_dimensions[L(c0 + 1)].width = 11
    ws.column_dimensions[L(c0 + 2)].width = 13
ws.freeze_panes = "D6"

sm = wb.create_sheet("الملخص")
sm.sheet_view.rightToLeft = True
sm["A1"] = "الملخص (يُحسب تلقائيًا من الاستمارة)"; sm["A1"].font = Font(name=F, size=13, bold=True)
sm["A3"] = "أخطاء الأسماء المسموحة"; sm["B3"] = 0
sm["A4"] = "أخطاء الأرقام المسموحة"; sm["B4"] = 0
sm["D3"] = "الحدّان مقترحان (صفر)، وأنت تعدّلهما. حدّ أخطاء النطق في الدقيقة يُحدَّد بعد أول استماع."
for a in ("A3", "A4"): sm[a].font = bold
for b in ("B3", "B4"):
    sm[b].font = blue; sm[b].fill = inp_fill; sm[b].border = box; sm[b].alignment = center
sm["D3"].font = base
cols = ["التسجيل", "متوسط الطبيعية", "متوسط ثبات الشخصية", "جمل بها خطأ", "أخطاء في جمل الأسماء", "أخطاء في جمل الأرقام", "الحكم"]
for j, h in enumerate(cols, 1):
    c = sm.cell(row=6, column=j, value=h); c.font = bold; c.fill = hdr_fill; c.alignment = center; c.border = box
S = "'استمارة السماع'!"
for k, e in enumerate(engines):
    r = 7 + k
    c0 = 4 + k * 3
    err = f"{S}{L(c0)}${FIRST}:{L(c0)}${LAST}"
    nat = f"{S}{L(c0+1)}${FIRST}:{L(c0+1)}${LAST}"
    con = f"{S}{L(c0+2)}${FIRST}:{L(c0+2)}${LAST}"
    cat = f"{S}$C${FIRST}:$C${LAST}"
    sm.cell(row=r, column=1, value=f"تسجيل {e}")
    sm.cell(row=r, column=2, value=f'=IFERROR(AVERAGE({nat}),"—")')
    sm.cell(row=r, column=3, value=f'=IFERROR(AVERAGE({con}),"—")')
    sm.cell(row=r, column=4, value=f'=SUMPRODUCT(--({err}<>""))')
    sm.cell(row=r, column=5, value=f'=SUMPRODUCT(ISNUMBER(SEARCH("اسم علم",{cat}))*({err}<>""))')
    sm.cell(row=r, column=6, value=f'=SUMPRODUCT(ISNUMBER(SEARCH("رقم",{cat}))*({err}<>""))')
    sm.cell(row=r, column=7, value=f'=IF(COUNT({nat})=0,"لم يُقيَّم",IF(AND(E{r}<=$B$3,F{r}<=$B$4),"يستوفي الحدّين","لا يستوفي"))')
    for col in range(1, 8):
        c = sm.cell(row=r, column=col); c.font = base; c.border = box; c.alignment = center
        if col in (2, 3): c.number_format = "0.0"
sm["A12"] = "ملاحظة: الأحكام تخص الأسماء والأرقام فقط، ولا تقيس الاقتراب من صوتَي كارما والراوي المعتمدين."
sm["A12"].font = base
sm.column_dimensions["A"].width = 26
for col in "BCDEF": sm.column_dimensions[col].width = 20
sm.column_dimensions["G"].width = 18
wb.save("audio-eval-listening-form.xlsx")
