using Syncfusion.DocIO;
using Syncfusion.DocIO.DLS;

namespace ContractWorkspace.TemplateGenerator;

static class LicenseBootstrap
{
    public static void Register()
    {
        var key = Environment.GetEnvironmentVariable("SYNCFUSION_LICENSE_KEY_v34")
                  ?? Environment.GetEnvironmentVariable("SYNCFUSION_LICENSE_KEY")
                  ?? string.Empty;
        Syncfusion.Licensing.SyncfusionLicenseProvider.RegisterLicense(key);
    }
}

/// <summary>
/// One-shot generator that authors the three showcase template DOCX files
/// (Mutual NDA, Service Agreement, Purchase Contract) under the document
/// service <c>wwwroot/Templates</c> directory. Each template embeds real Word
/// <c>MERGEFIELD</c> fields (rendered as <c>«Field»</c>) — never literal
/// <c>{{Token}}</c> text — so the fields are discoverable via DocIO
/// <c>GetMergeFieldNames()</c> and fillable server-side through
/// <c>MailMerge.Execute(...)</c>. Alongside the merge fields each template
/// carries bookmark anchors for its title, recital, three clause slots
/// (<c>Slot_Xy</c> label + <c>SlotBody_Slot_Xy</c> body that clause insertion
/// replaces in place) and a signature-block placeholder — aligned with the
/// contract lifecycle domain model and the 3-step workflow story.
///
/// Canonical merge-field set per template (single source of truth):
///   Mutual NDA        → CompanyName, CustomerContact, EffectiveDate,
///                       ContractValue, Jurisdiction, TermMonths
///   Service Agreement → CompanyName, CustomerContact, EffectiveDate,
///                       ContractValue, CompanyRegion, PaymentTerms
///   Purchase Contract → CompanyName, CustomerContact, EffectiveDate,
///                       ContractValue, DeliveryDate, WarrantyPeriod
///
/// Run <c>dotnet run --project src/ContractWorkspace.TemplateGenerator</c>
/// from the <c>server-side</c> directory after building the solution to
/// regenerate the assets.
/// </summary>
public static class Program
{
    // Typographic characters used in the clause text.
    private const string LQuote = "“"; // “
    private const string RQuote = "”"; // ”
    private const string Apos = "’";   // ’

    private static readonly string OutputPath = Path.Combine(
        AppContext.BaseDirectory,
        "..", "..", "..", "..",
        "ContractWorkspace.DocumentService", "wwwroot", "Templates");

    public static void Main()
    {
        LicenseBootstrap.Register();
        Directory.CreateDirectory(OutputPath);

        CreateMutualNda(Path.Combine(OutputPath, "MutualNDA.docx"));
        CreateServiceAgreement(Path.Combine(OutputPath, "ServiceAgreement.docx"));
        CreatePurchaseContract(Path.Combine(OutputPath, "PurchaseContract.docx"));

        Console.WriteLine($"Templates generated at: {Path.GetFullPath(OutputPath)}");
    }

    private static void CreateMutualNda(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Mutual Non-Disclosure Agreement", "Title_nda");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Disclosing Party: ", "CompanyName");
        AddFieldLine(section, "Receiving Party: ", "CustomerContact");
        section.AddParagraph();

        AddBookmark(section, "Background", paragraph =>
        {
            paragraph.AppendText($"This Mutual Non-Disclosure Agreement (the {LQuote}Agreement{RQuote}) is entered into as of ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" by and between ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText(" and ");
            paragraph.AppendField("CustomerContact", FieldType.FieldMergeField);
            paragraph.AppendText(", in connection with a prospective engagement valued at approximately ");
            paragraph.AppendField("ContractValue", FieldType.FieldMergeField);
            paragraph.AppendText($". Each party may disclose confidential and proprietary information to the other (the {LQuote}Confidential Information{RQuote}) solely to evaluate that opportunity.");
        });

        AddClauseSlot(section, "Confidentiality", "Slot_Confidentiality", paragraph =>
        {
            paragraph.AppendText($"Each party shall hold the other party{Apos}s Confidential Information in strict confidence, use it only to evaluate the contemplated relationship, and disclose it exclusively to representatives with a need to know who are bound by obligations of confidentiality no less protective than those set out in this Agreement.");
        });

        AddClauseSlot(section, "Exclusions", "Slot_Exclusions", paragraph =>
        {
            paragraph.AppendText("Confidential Information does not include information that is or becomes publicly available through no fault of the receiving party, was lawfully known to the receiving party before disclosure, is independently developed without use of the disclosing party" + Apos + "s Confidential Information, or is rightfully obtained from a third party without a duty of confidentiality.");
        });

        AddClauseSlot(section, "Term", "Slot_Term", paragraph =>
        {
            paragraph.AppendText("This Agreement remains in effect for ");
            paragraph.AppendField("TermMonths", FieldType.FieldMergeField);
            paragraph.AppendText(" months from the Effective Date. The confidentiality obligations survive for three (3) years following the return or destruction of all Confidential Information, and upon written request the receiving party shall promptly return or destroy such materials.");
        });

        AddLabeledClause(section, "Governing Law", paragraph =>
        {
            paragraph.AppendText("This Agreement is governed by and construed in accordance with the laws of ");
            paragraph.AppendField("Jurisdiction", FieldType.FieldMergeField);
            paragraph.AppendText(", without regard to its conflict-of-laws principles. The parties" + Apos + " sole remedy for breach includes injunctive relief in addition to any other remedies available at law or in equity.");
        });

        AddSignatureBlock(section, "SignatureBlock_Nda");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreateServiceAgreement(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Master Service Agreement", "Title_service");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Service Provider: ", "CompanyName");
        AddFieldLine(section, "Client: ", "CustomerContact");
        AddFieldLine(section, "Account Region: ", "CompanyRegion");
        section.AddParagraph();

        AddBookmark(section, "Scope", paragraph =>
        {
            paragraph.AppendText("Under this Master Service Agreement, ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Provider{RQuote}) shall perform the professional services described in each mutually executed Statement of Work for ");
            paragraph.AppendField("CustomerContact", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Client{RQuote}). This Agreement takes effect on ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" and governs every Statement of Work executed under it.");
        });

        AddClauseSlot(section, "Fees & Payment", "Slot_Payment", paragraph =>
        {
            paragraph.AppendText("In consideration of the services, Client shall pay Provider fees totaling ");
            paragraph.AppendField("ContractValue", FieldType.FieldMergeField);
            paragraph.AppendText(". Invoices are due and payable ");
            paragraph.AppendField("PaymentTerms", FieldType.FieldMergeField);
            paragraph.AppendText(" from the invoice date. Undisputed amounts that remain unpaid when due accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower.");
        });

        AddClauseSlot(section, "Liability", "Slot_Liability", paragraph =>
        {
            paragraph.AppendText("Except for breaches of confidentiality or a party" + Apos + "s indemnification obligations, each party" + Apos + "s aggregate liability under this Agreement is limited to the fees paid or payable during the twelve (12) months preceding the event giving rise to the claim, and neither party is liable for indirect, incidental, or consequential damages.");
        });

        AddClauseSlot(section, "Termination", "Slot_Termination", paragraph =>
        {
            paragraph.AppendText("Either party may terminate this Agreement or any Statement of Work for convenience upon thirty (30) days" + Apos + " written notice, or immediately for a material breach that remains uncured fifteen (15) days after written notice. Upon termination, Client shall pay for all services performed through the effective date of termination.");
        });

        AddSignatureBlock(section, "SignatureBlock_Service");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void CreatePurchaseContract(string path)
    {
        using var doc = new WordDocument();
        var section = doc.AddSection();

        AddHeading(section, "Purchase Contract", "Title_purchase");

        AddFieldLine(section, "Effective Date: ", "EffectiveDate");
        AddFieldLine(section, "Seller: ", "CompanyName");
        AddFieldLine(section, "Buyer Contact: ", "CustomerContact");
        AddFieldLine(section, "Total Order Value: ", "ContractValue");
        section.AddParagraph();

        AddBookmark(section, "Goods", paragraph =>
        {
            paragraph.AppendText("This Purchase Contract is entered into as of ");
            paragraph.AppendField("EffectiveDate", FieldType.FieldMergeField);
            paragraph.AppendText(" between ");
            paragraph.AppendField("CompanyName", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Seller{RQuote}) and ");
            paragraph.AppendField("CustomerContact", FieldType.FieldMergeField);
            paragraph.AppendText($" (the {LQuote}Buyer{RQuote}) for the purchase of the goods itemized in the exhibit attached hereto, for total consideration of ");
            paragraph.AppendField("ContractValue", FieldType.FieldMergeField);
            paragraph.AppendText(", exclusive of applicable taxes and duties.");
        });

        AddClauseSlot(section, "Delivery", "Slot_Delivery", paragraph =>
        {
            paragraph.AppendText("Seller shall deliver the goods to Buyer" + Apos + "s designated address on or before ");
            paragraph.AppendField("DeliveryDate", FieldType.FieldMergeField);
            paragraph.AppendText(", freight prepaid, with risk of loss passing to Buyer upon delivery. Buyer may inspect the goods within ten (10) business days of receipt and reject any non-conforming items for prompt replacement.");
        });

        AddClauseSlot(section, "Warranty", "Slot_Warranty", paragraph =>
        {
            paragraph.AppendText("Seller warrants that the goods will be free from defects in material and workmanship and will conform to the agreed specifications for a period of ");
            paragraph.AppendField("WarrantyPeriod", FieldType.FieldMergeField);
            paragraph.AppendText(" from the delivery date. Buyer" + Apos + "s exclusive remedy for breach of this warranty is the repair or replacement of the defective goods at Seller" + Apos + "s expense.");
        });

        AddClauseSlot(section, "Data Protection", "Slot_DataProtection", paragraph =>
        {
            paragraph.AppendText("Each party shall comply with all applicable data protection and privacy laws in connection with any personal data exchanged under this Contract, and shall implement appropriate technical and organizational measures to safeguard such data against unauthorized access or disclosure.");
        });

        AddSignatureBlock(section, "SignatureBlock_Purchase");
        ApplyDefaultFont(doc);
        doc.Save(path, FormatType.Docx);
        doc.Close();
    }

    private static void AddHeading(IWSection section, string text, string bookmarkName)
    {
        var paragraph = section.AddParagraph();
        paragraph.AppendBookmarkStart(bookmarkName);
        var span = paragraph.AppendText(text);
        span.CharacterFormat.Bold = true;
        span.CharacterFormat.FontSize = 18f;
        span.CharacterFormat.FontName = DefaultFontName;
        paragraph.AppendBookmarkEnd(bookmarkName);
        section.AddParagraph();
    }

    /// <summary>
    /// Emits a bold label followed by a real MERGEFIELD on a single line, e.g.
    /// "Effective Date: «EffectiveDate»".
    /// </summary>
    private static void AddFieldLine(IWSection section, string label, string fieldName)
    {
        var paragraph = section.AddParagraph();
        var labelText = paragraph.AppendText(label);
        labelText.CharacterFormat.Bold = true;
        paragraph.AppendField(fieldName, FieldType.FieldMergeField);
    }

    private static void AddBookmark(IWSection section, string bookmarkName, Action<IWParagraph> body)
    {
        var paragraph = section.AddParagraph();
        paragraph.AppendBookmarkStart(bookmarkName);
        body(paragraph);
        paragraph.AppendBookmarkEnd(bookmarkName);
        section.AddParagraph();
    }

    /// <summary>
    /// Emits a clause slot: a bold label wrapped in <c>Slot_Xy</c> and a body
    /// paragraph wrapped in <c>SlotBody_Slot_Xy</c>. The frontend clause
    /// library selects the body bookmark and replaces its contents in place, so
    /// the body carries a realistic default clause (which may embed merge
    /// fields) rather than a bracketed placeholder.
    /// </summary>
    private static void AddClauseSlot(IWSection section, string slotLabel, string bookmarkName, Action<IWParagraph> body)
    {
        var labelParagraph = section.AddParagraph();
        labelParagraph.AppendBookmarkStart(bookmarkName);
        var labelText = labelParagraph.AppendText(slotLabel + ": ");
        labelText.CharacterFormat.Bold = true;
        labelParagraph.AppendBookmarkEnd(bookmarkName);

        var slotPlaceholder = section.AddParagraph();
        slotPlaceholder.AppendBookmarkStart("SlotBody_" + bookmarkName);
        body(slotPlaceholder);
        slotPlaceholder.AppendBookmarkEnd("SlotBody_" + bookmarkName);
        section.AddParagraph();
    }

    /// <summary>
    /// Emits a fixed (non-slot) clause: a bold inline label followed by body
    /// text in the same paragraph. Used for clauses that are not editable
    /// insertion targets but still carry merge fields (e.g. Governing Law).
    /// </summary>
    private static void AddLabeledClause(IWSection section, string label, Action<IWParagraph> body)
    {
        var paragraph = section.AddParagraph();
        var labelText = paragraph.AppendText(label + ": ");
        labelText.CharacterFormat.Bold = true;
        body(paragraph);
        section.AddParagraph();
    }

    private static void AddSignatureBlock(IWSection section, string bookmarkName)
    {
        section.AddParagraph();
        var signatureBlock = section.AddParagraph();
        signatureBlock.AppendBookmarkStart(bookmarkName);
        signatureBlock.AppendText("[Signature Pad Placeholder — image signature inserted here]");
        signatureBlock.AppendBookmarkEnd(bookmarkName);
        section.AddParagraph();

        var signerParagraph = section.AddParagraph();
        signerParagraph.AppendText("Signed by: _______________________     Date: ____________");
    }

    private const string DefaultFontName = "Calibri";

    /// <summary>
    /// Sets Calibri as the document default (Normal style + every text range)
    /// so the Document Editor opens templates in Calibri rather than DocIO's
    /// Times New Roman fallback.
    /// </summary>
    private static void ApplyDefaultFont(WordDocument doc)
    {
        if (doc.Styles.FindByName("Normal") is WParagraphStyle normal)
        {
            normal.CharacterFormat.FontName = DefaultFontName;
            normal.CharacterFormat.FontSize = 11f;
        }

        foreach (WSection section in doc.Sections)
        {
            foreach (WParagraph paragraph in section.Body.Paragraphs)
            {
                foreach (var item in paragraph.ChildEntities)
                {
                    if (item is WTextRange textRange)
                    {
                        textRange.CharacterFormat.FontName = DefaultFontName;
                    }
                }
            }
        }
    }
}
