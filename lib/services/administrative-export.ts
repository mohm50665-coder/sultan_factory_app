import { Platform, Share } from "react-native";
import { administrativeService, AdministrativeData } from "./data.service";

const REQUEST_TYPES: Record<string, string> = {
  leave_request: "طلب إجازة",
  recall_request: "طلب استدعاء",
  advance_request: "طلب سلفة",
  resignation_request: "طلب استقالة",
  sponsorship_transfer: "طلب نقل كفالة",
  advance_salary: "طلب تقدم راتب",
  training_request: "طلب تدريب",
  transfer_request: "طلب نقل",
};

const DEPARTMENTS: Record<string, string> = {
  production: "الإنتاج",
  administrative: "الإجراءات الإدارية والمصروفات",
  sales: "المبيعات والتحصيل",
  maintenance: "الصيانة",
  board_representative: "ممثل مجلس الإدارة",
  warehouse: "المستودعات",
};

function getRequestTypeLabel(type: string): string {
  return REQUEST_TYPES[type] || type;
}

function getDepartmentLabel(dept: string): string {
  return DEPARTMENTS[dept] || dept || "غير محدد";
}

function getStatusLabel(status: string): string {
  if (status === "approved") return "موافق";
  if (status === "rejected") return "مرفوض";
  return "قيد الانتظار";
}

function getStatusColor(status: string): string {
  if (status === "approved") return "#22C55E";
  if (status === "rejected") return "#EF4444";
  return "#F59E0B";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export const administrativeExportService = {
  generateHTML(requests: AdministrativeData[]): string {
    const rows = requests
      .map(
        (r) => `
      <tr>
        <td>${r.referenceNumber || "-"}</td>
        <td>${r.employeeName}</td>
        <td>${r.employeeNumber || "-"}</td>
        <td>${getDepartmentLabel(r.department)}</td>
        <td>${getRequestTypeLabel(r.requestType)}</td>
        <td>${formatDate(r.submissionDate)}</td>
        <td><span class="status" style="background:${getStatusColor(r.directManagerStatus)}20;color:${getStatusColor(r.directManagerStatus)}">${getStatusLabel(r.directManagerStatus)}</span></td>
        <td><span class="status" style="background:${getStatusColor(r.generalManagerStatus)}20;color:${getStatusColor(r.generalManagerStatus)}">${getStatusLabel(r.generalManagerStatus)}</span></td>
        <td><span class="status" style="background:${getStatusColor(r.boardRepStatus)}20;color:${getStatusColor(r.boardRepStatus)}">${getStatusLabel(r.boardRepStatus)}</span></td>
      </tr>`
      )
      .join("");

    const pendingCount = requests.filter(
      (r) => r.directManagerStatus === "pending" || r.generalManagerStatus === "pending" || r.boardRepStatus === "pending"
    ).length;
    const approvedCount = requests.filter(
      (r) => r.directManagerStatus === "approved" && r.generalManagerStatus === "approved" && r.boardRepStatus === "approved"
    ).length;
    const rejectedCount = requests.filter(
      (r) => r.directManagerStatus === "rejected" || r.generalManagerStatus === "rejected" || r.boardRepStatus === "rejected"
    ).length;

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير الإجراءات الإدارية</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
    h1 { color: #0a7ea4; text-align: center; margin-bottom: 5px; }
    h2 { color: #333; text-align: center; margin-bottom: 5px; }
    .date { text-align: center; color: #666; margin-bottom: 20px; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; gap: 10px; }
    .stat-box { background: #f5f5f5; border-radius: 10px; padding: 15px; text-align: center; min-width: 100px; flex: 1; }
    .stat-number { font-size: 24px; font-weight: bold; color: #0a7ea4; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    .stat-box.pending .stat-number { color: #F59E0B; }
    .stat-box.approved .stat-number { color: #22C55E; }
    .stat-box.rejected .stat-number { color: #EF4444; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    th { background: #0a7ea4; color: white; padding: 10px; text-align: center; }
    td { padding: 8px; text-align: center; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .status { padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .footer { text-align: center; color: #999; margin-top: 30px; font-size: 12px; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>مصنع السلطان</h1>
  <h2>تقرير الإجراءات الإدارية</h2>
  <p class="date">تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA")}</p>

  <div class="stats">
    <div class="stat-box">
      <div class="stat-number">${requests.length}</div>
      <div class="stat-label">إجمالي الطلبات</div>
    </div>
    <div class="stat-box pending">
      <div class="stat-number">${pendingCount}</div>
      <div class="stat-label">قيد الانتظار</div>
    </div>
    <div class="stat-box approved">
      <div class="stat-number">${approvedCount}</div>
      <div class="stat-label">موافق عليها</div>
    </div>
    <div class="stat-box rejected">
      <div class="stat-number">${rejectedCount}</div>
      <div class="stat-label">مرفوضة</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>الرقم المرجعي</th>
        <th>اسم الموظف</th>
        <th>الرقم الوظيفي</th>
        <th>القسم</th>
        <th>نوع الطلب</th>
        <th>تاريخ التقديم</th>
        <th>المدير المباشر</th>
        <th>المدير العام</th>
        <th>ممثل مجلس الإدارة</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    تم إنشاء هذا التقرير بواسطة تطبيق متابعة أداء مصنع السلطان | ${new Date().toLocaleString("ar-SA")}
  </div>
</body>
</html>`;
  },

  async exportAll(): Promise<void> {
    try {
      const requests = await administrativeService.getAll();
      if (requests.length === 0) {
        if (Platform.OS === "web") {
          window.alert("لا توجد طلبات لتصديرها");
        }
        return;
      }

      const html = this.generateHTML(requests);

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        const textContent = requests
          .map(
            (r) =>
              `${r.referenceNumber || ""} | ${r.employeeName} | ${getRequestTypeLabel(r.requestType)} | ${getDepartmentLabel(r.department)} | المدير المباشر: ${getStatusLabel(r.directManagerStatus)} | المدير العام: ${getStatusLabel(r.generalManagerStatus)} | ممثل م.إ: ${getStatusLabel(r.boardRepStatus)}`
          )
          .join("\n");
        await Share.share({
          message: `تقرير الإجراءات الإدارية\n${new Date().toLocaleDateString("ar-SA")}\n\n${textContent}`,
          title: "تقرير الإجراءات الإدارية",
        });
      }
    } catch (error) {
      console.error("Failed to export administrative requests:", error);
    }
  },

  async exportSingle(request: AdministrativeData): Promise<void> {
    try {
      const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>طلب إداري - ${request.referenceNumber || ""}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 30px; direction: rtl; }
    h1 { color: #0a7ea4; text-align: center; border-bottom: 2px solid #0a7ea4; padding-bottom: 10px; }
    .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .section h3 { color: #0a7ea4; margin-bottom: 10px; }
    .field { display: flex; margin: 8px 0; }
    .field-label { font-weight: bold; min-width: 150px; color: #333; }
    .field-value { color: #555; }
    .status { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; }
    .approval-row { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; }
    .footer { text-align: center; color: #999; margin-top: 30px; font-size: 12px; }
    @media print { body { padding: 10px; } }
  </style>
</head>
<body>
  <h1>طلب إداري - ${getRequestTypeLabel(request.requestType)}</h1>
  
  <div class="section">
    <h3>البيانات الأساسية</h3>
    <div class="field"><span class="field-label">الرقم المرجعي:</span><span class="field-value">${request.referenceNumber || "-"}</span></div>
    <div class="field"><span class="field-label">تاريخ التقديم:</span><span class="field-value">${formatDate(request.submissionDate)}</span></div>
    <div class="field"><span class="field-label">اسم الموظف:</span><span class="field-value">${request.employeeName}</span></div>
    <div class="field"><span class="field-label">الرقم الوظيفي:</span><span class="field-value">${request.employeeNumber || "-"}</span></div>
    <div class="field"><span class="field-label">الإدارة/القسم:</span><span class="field-value">${getDepartmentLabel(request.department)}</span></div>
    <div class="field"><span class="field-label">نوع الطلب:</span><span class="field-value">${getRequestTypeLabel(request.requestType)}</span></div>
    <div class="field"><span class="field-label">تفاصيل الطلب:</span><span class="field-value">${request.requestDetails}</span></div>
    ${request.attachments && request.attachments.length > 0 ? `<div class="field"><span class="field-label">المرفقات:</span><span class="field-value">${request.attachments.join("، ")}</span></div>` : ""}
  </div>

  <div class="section">
    <h3>الموافقات</h3>
    <div class="approval-row">
      <span class="field-label">المدير المباشر:</span>
      <span class="status" style="background:${getStatusColor(request.directManagerStatus)}20;color:${getStatusColor(request.directManagerStatus)}">${getStatusLabel(request.directManagerStatus)}</span>
      <span>${request.directManagerActionDate ? formatDate(request.directManagerActionDate) : "-"}</span>
    </div>
    ${request.directManagerRejectionReason ? `<div style="padding:5px 10px;color:#EF4444;font-size:12px;">سبب الرفض: ${request.directManagerRejectionReason}</div>` : ""}
    <div class="approval-row">
      <span class="field-label">المدير العام:</span>
      <span class="status" style="background:${getStatusColor(request.generalManagerStatus)}20;color:${getStatusColor(request.generalManagerStatus)}">${getStatusLabel(request.generalManagerStatus)}</span>
      <span>${request.generalManagerActionDate ? formatDate(request.generalManagerActionDate) : "-"}</span>
    </div>
    ${request.generalManagerRejectionReason ? `<div style="padding:5px 10px;color:#EF4444;font-size:12px;">سبب الرفض: ${request.generalManagerRejectionReason}</div>` : ""}
    <div class="approval-row">
      <span class="field-label">ممثل مجلس الإدارة:</span>
      <span class="status" style="background:${getStatusColor(request.boardRepStatus)}20;color:${getStatusColor(request.boardRepStatus)}">${getStatusLabel(request.boardRepStatus)}</span>
      <span>${request.boardRepActionDate ? formatDate(request.boardRepActionDate) : "-"}</span>
    </div>
    ${request.boardRepRejectionReason ? `<div style="padding:5px 10px;color:#EF4444;font-size:12px;">سبب الرفض: ${request.boardRepRejectionReason}</div>` : ""}
  </div>

  <div class="footer">
    تم إنشاء هذا التقرير بواسطة تطبيق متابعة أداء مصنع السلطان | ${new Date().toLocaleString("ar-SA")}
  </div>
</body>
</html>`;

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      } else {
        const content = `طلب إداري - ${getRequestTypeLabel(request.requestType)}\n` +
          `الرقم المرجعي: ${request.referenceNumber || "-"}\n` +
          `تاريخ التقديم: ${formatDate(request.submissionDate)}\n` +
          `اسم الموظف: ${request.employeeName}\n` +
          `الرقم الوظيفي: ${request.employeeNumber || "-"}\n` +
          `القسم: ${getDepartmentLabel(request.department)}\n` +
          `التفاصيل: ${request.requestDetails}\n\n` +
          `الموافقات:\n` +
          `- المدير المباشر: ${getStatusLabel(request.directManagerStatus)}\n` +
          `- المدير العام: ${getStatusLabel(request.generalManagerStatus)}\n` +
          `- ممثل مجلس الإدارة: ${getStatusLabel(request.boardRepStatus)}`;
        await Share.share({
          message: content,
          title: `طلب إداري - ${request.employeeName}`,
        });
      }
    } catch (error) {
      console.error("Failed to export single request:", error);
    }
  },
};
