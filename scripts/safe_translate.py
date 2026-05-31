#!/usr/bin/env python3
"""
سكريبت ترجمة آمن يستبدل النصوص العربية بـ t("key")
"""

import re
import json
import os
from pathlib import Path
from collections import defaultdict

# قاموس الترجمات
TRANSLATIONS = {
    "إجمالي الإنتاج": "total_production",
    "معدل الهدر": "waste_rate",
    "إجمالي المبيعات": "total_sales",
    "عمليات الصيانة": "maintenance_operations",
    "درزن": "dozen",
    "ريال": "sar",
    "عملية": "operation",
    "الهدر": "waste",
    "النخب الثاني": "second_grade",
    "جاري تحميل البيانات...": "loading_data",
    "مقارنة بالأمس": "compared_to_yesterday",
    "يوم": "day",
    "أسبوع": "week",
    "شهر": "month",
    "لوحة المعلومات": "dashboard",
    "مؤشرات الأداء الرئيسية": "key_performance_indicators",
    "مؤشرات الأداء": "performance_indicators",
    "توزيع الإنتاج": "production_distribution",
    "معلومات مهمة": "important_info",
    "الإنتاج": "production",
    "الإنتاج (درزن)": "production_dozen",
    "الإنتاج (زوج)": "production_pairs",
    "هدر الخيوط (جرام)": "waste_thread",
    "هدر الجوارب (جرام)": "waste_socks",
    "النخب الثاني (زوج)": "second_grade_pairs",
    "هدر الإبر (حبة)": "waste_needles",
    "رقم المكينة": "machine_number",
    "المجموع": "total",
    "التاريخ": "date",
    "المبيعات": "sales",
    "التحصيل": "collection",
    "المستودعات": "warehouse",
    "الصيانة": "maintenance",
    "المصروفات": "expenses",
    "مراحل التصنيع": "manufacturing_stages",
    "الإجراءات الإدارية": "administrative",
    "إضافة": "add",
    "تعديل": "edit",
    "حذف": "delete",
    "حفظ": "save",
    "إلغاء": "cancel",
    "بحث": "search",
    "تصفية": "filter",
    "الكل": "all",
    "رجوع": "back",
    "تأكيد": "confirm",
    "نجاح": "success",
    "خطأ": "error",
    "تحذير": "warning",
    "جاري التحميل...": "loading",
    "لا توجد بيانات": "no_data",
    "نعم": "yes",
    "لا": "no",
    "إغلاق": "close",
    "الإعدادات": "settings",
    "اللغة": "language",
    "تسجيل الدخول": "login",
    "تسجيل الخروج": "logout",
    "اسم المستخدم": "username",
    "كلمة المرور": "password",
    "الاسم الكامل": "full_name",
    "رقم الجوال": "phone",
    "الملف الشخصي": "profile",
    "تغيير كلمة المرور": "change_password",
    "معلومات الحساب": "account_info",
    "الرئيسية": "home",
    "الأقسام الرئيسية": "main_sections",
    "أدوات إضافية": "extra_tools",
    "التقارير": "reports",
    "الإشعارات": "notifications",
    "التصدير": "export",
    "سجل النشاطات": "activity_log",
    "تصدير الإنتاج": "production_export",
    "تنبيهات الهدر": "waste_alerts",
    "إدارة المستخدمين": "users_management",
    "الدور": "role",
    "الصلاحيات": "permissions",
    "مدير النظام": "admin",
    "مدير": "manager",
    "مشرف": "supervisor",
    "مشغل": "operator",
    "مشاهد": "viewer",
    "محاسب": "accountant",
    "أمين مستودع": "warehouse_keeper",
    "مندوب مبيعات": "sales_rep",
    "فني صيانة": "maintenance_tech",
    "مسؤول موارد بشرية": "hr_officer",
    "مرحباً": "welcome",
    "مصنع السلطان": "app_name",
    "نظام متابعة أداء المصنع": "app_subtitle",
}

def extract_arabic_strings(file_path):
    """استخراج جميع النصوص العربية من ملف"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # البحث عن النصوص العربية في الـ JSX والـ JavaScript
    # نمط: "نص عربي" أو 'نص عربي'
    pattern = r'["\']([^"\']*[\u0600-\u06FF]+[^"\']*)["\']'
    matches = re.findall(pattern, content)
    
    return list(set(matches))

def translate_file(file_path):
    """ترجمة ملف واحد"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # التحقق من وجود import useLanguage
    if 'useLanguage' not in content and 'import' in content:
        # إضافة import إذا لم يكن موجوداً
        if 'import {' in content:
            # إيجاد آخر import
            last_import_match = None
            for match in re.finditer(r'import\s+{[^}]*}\s+from\s+["\'][^"\']+["\'];', content):
                last_import_match = match
            
            if last_import_match:
                insert_pos = last_import_match.end()
                # التحقق من عدم وجود import useLanguage
                if 'useLanguage' not in content[:insert_pos]:
                    content = content[:insert_pos] + '\nimport { useLanguage } from "@/lib/language-context";' + content[insert_pos:]
    
    # استبدال النصوص العربية
    for arabic_text, key in TRANSLATIONS.items():
        # البحث عن النص في الـ JSX
        # نمط: label="نص" أو label='نص' أو label={t("key")}
        pattern = rf'([a-zA-Z_]+)=(["\']){re.escape(arabic_text)}\2'
        replacement = rf'\1={{t("{key}")}}'
        content = re.sub(pattern, replacement, content)
        
        # نمط: <Text>"نص"</Text> أو <Text>'نص'</Text>
        pattern = rf'(<Text[^>]*>)(["\'])?{re.escape(arabic_text)}\2(</Text>)'
        replacement = rf'\1{{t("{key}")}}\3'
        content = re.sub(pattern, replacement, content)
        
        # نمط: unit="نص" أو unit='نص'
        pattern = rf'(unit)=(["\']){re.escape(arabic_text)}\2'
        replacement = rf'\1={{t("{key}")}}'
        content = re.sub(pattern, replacement, content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True

# الملفات المراد ترجمتها
files_to_translate = [
    "app/production.tsx",
    "app/sales.tsx",
    "app/warehouse.tsx",
    "app/maintenance.tsx",
    "app/financial.tsx",
    "app/manufacturing.tsx",
    "app/collection.tsx",
    "app/administrative.tsx",
]

print("🔄 جاري ترجمة الملفات...")
for file_path in files_to_translate:
    full_path = Path("/home/ubuntu/sultan_factory_app") / file_path
    if full_path.exists():
        try:
            translate_file(str(full_path))
            print(f"✅ {file_path}")
        except Exception as e:
            print(f"❌ {file_path}: {e}")
    else:
        print(f"⚠️ {file_path} - لم يتم العثور عليه")

print("\n✅ اكتملت عملية الترجمة!")
