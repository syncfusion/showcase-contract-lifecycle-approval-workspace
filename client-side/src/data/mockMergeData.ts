/**
 * Deterministic mock merge-data datasets for the "Preview with data" dialog.
 * Each entry is a fictional customer/counterparty whose JSON
 * values map onto the union of all template `fieldKeys`. The user picks one in
 * the dialog and the server-side DocIO mail merge fills every «MergeField» in
 * the loaded template .docx with the supplied value.
 *
 * 100% synthetic — no real personal or commercial data. Deterministic
 * (no Date.now / Math.random).
 */

export interface MockMergeDataset {
  id: string;
  name: string;
  /** Short descriptor shown under the name in the list. */
  subtitle: string;
  /** Merge-field name (bare, no braces) → value. */
  values: Record<string, string>;
}

export const mockMergeDatasets: MockMergeDataset[] = [
  {
    id: "ds-northwind",
    name: "Northwind Traders",
    subtitle: "Strategic · Wholesale Distribution",
    values: {
      CompanyName: "Northwind Traders",
      CustomerContact: "Priya Shah",
      EffectiveDate: "October 1, 2026",
      ContractValue: "$284,500",
      CompanyRegion: "North America",
      Jurisdiction: "State of Delaware, USA",
      TermMonths: "24",
      PaymentTerms: "Net 30",
      DeliveryDate: "November 15, 2026",
      WarrantyPeriod: "12 months",
    },
  },
  {
    id: "ds-contoso",
    name: "Contoso Ltd",
    subtitle: "Enterprise · Technology Services",
    values: {
      CompanyName: "Contoso Ltd",
      CustomerContact: "Elena Rostova",
      EffectiveDate: "November 15, 2026",
      ContractValue: "$512,000",
      CompanyRegion: "Europe",
      Jurisdiction: "England and Wales",
      TermMonths: "36",
      PaymentTerms: "Net 45",
      DeliveryDate: "January 10, 2027",
      WarrantyPeriod: "24 months",
    },
  },
  {
    id: "ds-fabrikam",
    name: "Fabrikam Inc",
    subtitle: "Growth · Industrial Manufacturing",
    values: {
      CompanyName: "Fabrikam Inc",
      CustomerContact: "Jordan Lee",
      EffectiveDate: "September 5, 2026",
      ContractValue: "$98,750",
      CompanyRegion: "North America",
      Jurisdiction: "State of California, USA",
      TermMonths: "12",
      PaymentTerms: "Net 15",
      DeliveryDate: "October 20, 2026",
      WarrantyPeriod: "18 months",
    },
  },
  {
    id: "ds-adventure",
    name: "Adventure Works",
    subtitle: "Mid-market · Outdoor Retail",
    values: {
      CompanyName: "Adventure Works",
      CustomerContact: "Marcus Hall",
      EffectiveDate: "December 1, 2026",
      ContractValue: "$176,200",
      CompanyRegion: "Asia Pacific",
      Jurisdiction: "Singapore",
      TermMonths: "18",
      PaymentTerms: "Net 30",
      DeliveryDate: "February 1, 2027",
      WarrantyPeriod: "12 months",
    },
  },
  {
    id: "ds-trey",
    name: "Trey Research",
    subtitle: "Startup · Biotech R&D",
    values: {
      CompanyName: "Trey Research",
      CustomerContact: "Dana Reyes",
      EffectiveDate: "August 20, 2026",
      ContractValue: "$64,300",
      CompanyRegion: "North America",
      Jurisdiction: "State of New York, USA",
      TermMonths: "12",
      PaymentTerms: "Net 60",
      DeliveryDate: "September 30, 2026",
      WarrantyPeriod: "6 months",
    },
  },
];
