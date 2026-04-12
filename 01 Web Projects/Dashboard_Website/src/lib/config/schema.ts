import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 1 as const;

const NonEmptyString = z.string().trim().min(1);
const Money = z.number().finite().nonnegative();
// ⚠ Unit convention is split across sections of docs/07-config-reference.md:
//   - profile / debts / property / mortgage / familyProperty / children → decimal (0–1)
//   - defaults.*                                                        → percent  (0–100)
// This is documented in the canonical sample config (doc 07 §10 lines 510–526) and is
// therefore load-bearing for Gate 4.4 until a spec decision resolves the inconsistency.
// Do NOT unify these without a paired doc 07 edit — raw JSON/localStorage/API payloads
// are not type-checked, so a mismatched primitive will be rejected at parse time
// (not caught by tsc). Tracked as a schema-level open question; see OPEN-QUESTIONS.
const DecimalRate = z.number().finite().min(0).max(1);
const PercentRate = z.number().finite().min(0).max(100);
const Year = z.number().int().min(2020).max(2100);
// Accepts 3-digit (#abc) and 6-digit (#aabbcc) hex. See CRITICAL-FIXES §1.9.
const HexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

// `id` is required per docs/12-state-management.md — the Zustand debt slice assigns a
// stable id on addDebt() and consumers (removeDebt, updateDebt) key off it. Any persisted
// or API-bound payload carries the id, so a strict schema without it would reject round-trips.
export const DebtSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  balance: Money,
  payment: Money,
  rate: DecimalRate,
  color: HexColor,
}).strict();

export const PaidOffDebtSchema = z.object({
  name: NonEmptyString,
  finalPayment: Money,
  // Informational display field. doc 07 format: "Jan 2026".
  datePaid: NonEmptyString,
}).strict();

export const ExpenseItemSchema = z.object({
  category: NonEmptyString,
  monthly: Money,
}).strict();

export const BudgetTrendDatasetSchema = z.object({
  label: NonEmptyString,
  data: z.array(Money),
  color: HexColor,
}).strict();

export const BudgetChartSchema = z
  .object({
    categories: z.array(NonEmptyString),
    amounts: z.array(Money),
    colors: z.array(HexColor),
    monthlyTrend: z
      .object({
        months: z.array(NonEmptyString),
        datasets: z.array(BudgetTrendDatasetSchema),
      })
      .strict(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (
      val.categories.length !== val.amounts.length ||
      val.categories.length !== val.colors.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `budgetChart arrays must align: categories=${val.categories.length}, amounts=${val.amounts.length}, colors=${val.colors.length}`,
        path: ["categories"],
      });
    }
    val.monthlyTrend.datasets.forEach((ds, i) => {
      if (ds.data.length !== val.monthlyTrend.months.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `monthlyTrend.datasets[${i}].data length (${ds.data.length}) must match months length (${val.monthlyTrend.months.length})`,
          path: ["monthlyTrend", "datasets", i, "data"],
        });
      }
    });
  });

// Q1 resolved 2026-04-11: persisted schema uses user1/user2; matty/partner are display
// aliases exposed via lib/selectors/personas.ts only. See CRITICAL-FIXES §2.1.
export const ProfileSchema = z
  .object({
    user1: z
      .object({
        name: NonEmptyString,
        age: z.number().int().min(18).max(70),
        superBalance: Money,
        salary: Money,
        superRate: DecimalRate,
        bonus: DecimalRate,
        futureSalary: Money,
        futureSuperRate: DecimalRate,
        switchYear: Year,
      })
      .strict(),
    user2: z
      .object({
        name: NonEmptyString,
        age: z.number().int().min(18).max(70),
        superBalance: Money,
        salary: Money,
        employer: NonEmptyString,
      })
      .strict(),
    currentYear: Year,
    projectionYears: z.number().int().min(10).max(50),
    // Range matches docs/07-config-reference.md §1 Profile exactly (55–67) for Gate 4.4.
    // CRITICAL-FIXES §1.3 proposes tightening to max(60) per AU preservation-age legislation;
    // that tightening must land in doc 07 first (a paired edit), then here. Do not tighten
    // the range unilaterally — it would reject valid older-cohort data on load.
    preservationAge: z.number().int().min(55).max(67),
    contribTaxRate: DecimalRate,
    concessionalCap: Money,
    // APP 3 collection notice acceptance timestamp. Null until the user dismisses
    // CollectionNoticeModal on first /dashboard load. See docs/27-privacy.md §3
    // and CRITICAL-FIXES §2.5. loader.ts normalise() seeds this to null for
    // legacy payloads that pre-date Phase 1.
    privacyNoticeAcceptedAt: z.string().datetime().nullable().default(null),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.user1.switchYear < val.currentYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["user1", "switchYear"],
        message: `user1.switchYear (${val.user1.switchYear}) must be >= currentYear (${val.currentYear})`,
      });
    }
  });

export const DebtsSchema = z
  .object({
    active: z.array(DebtSchema),
    paidOff: z.array(PaidOffDebtSchema),
    lumpSum: Money,
    // Informational narrative; "Any text" per doc 07. Not used in calculations.
    lumpSumBreakdown: z.string(),
    monthlySurplus: Money,
  })
  .strict();

export const ExpensesSchema = z
  .object({
    fixed: z.array(ExpenseItemSchema),
    variable: z.array(ExpenseItemSchema),
    budgetChart: BudgetChartSchema,
  })
  .strict();

export const PropertySchema = z
  .object({
    targetPrice: Money.min(100_000),
    stampDuty: Money,
    legals: Money,
    appreciationRate: DecimalRate,
    hisaRate: DecimalRate,
  })
  .strict();

// Q1 resolved 2026-04-11: canonical field names per CRITICAL-FIXES §2.2.
export const MortgageSchema = z
  .object({
    loanAmount: Money,
    startYear: Year,
    rate: DecimalRate,
    termYears: z.number().int().min(10).max(40),
    ioPeriodYears: z.number().int().min(0).max(15),
    mode: z.enum(["io-then-pi", "pi-only", "io-only"]),
    propertyValue: Money,
    propertyGrowth: DecimalRate,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.ioPeriodYears > val.termYears) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ioPeriodYears"],
        message: `ioPeriodYears (${val.ioPeriodYears}) cannot exceed termYears (${val.termYears})`,
      });
    }
  });

export const FamilyPropertySchema = z
  .object({
    address: NonEmptyString,
    purchasePrice: Money,
    currentValue: Money,
    ownershipShare: DecimalRate,
    weeklyRent: Money,
    growthRate: DecimalRate,
    loans: z
      .object({
        mortgage: Money,
        equityLoan: Money,
        mortgageTerms: z
          .object({
            rate: DecimalRate,
            totalTerm: z.number().int().min(5).max(40),
            ioPeriod: z.number().int().min(0).max(15),
            mode: z.enum(["io-then-pi", "full-pi"]),
          })
          .strict(),
      })
      .strict(),
    parents: z
      .object({
        parent1Age: z.number().int().min(50).max(100),
        parent2Age: z.number().int().min(50).max(100),
        lifeExpectancy1: z.number().int().min(65).max(110),
        lifeExpectancy2: z.number().int().min(65).max(110),
      })
      .strict(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const { parents, loans } = val;
    if (parents.lifeExpectancy1 < parents.parent1Age) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parents", "lifeExpectancy1"],
        message: `lifeExpectancy1 (${parents.lifeExpectancy1}) must be >= parent1Age (${parents.parent1Age})`,
      });
    }
    if (parents.lifeExpectancy2 < parents.parent2Age) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parents", "lifeExpectancy2"],
        message: `lifeExpectancy2 (${parents.lifeExpectancy2}) must be >= parent2Age (${parents.parent2Age})`,
      });
    }
    if (loans.mortgageTerms.ioPeriod > loans.mortgageTerms.totalTerm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["loans", "mortgageTerms", "ioPeriod"],
        message: `ioPeriod (${loans.mortgageTerms.ioPeriod}) cannot exceed totalTerm (${loans.mortgageTerms.totalTerm})`,
      });
    }
  });

export const ChildrenSchema = z
  .object({
    count: z.number().int().min(0).max(5),
    year1: Year,
    year2: Year,
    childcareCostPerYear: Money,
    schoolCostPerYear: Money,
    leaveReduction: DecimalRate,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.count >= 2 && val.year2 < val.year1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["year2"],
        message: `year2 (${val.year2}) must be >= year1 (${val.year1}) when count >= 2`,
      });
    }
  });

// Per docs/07-config-reference.md §10 (canonical sample config, lines 510–526), every
// rate field inside `defaults.*` is stored as a PERCENT value (0–100), e.g.
// returnRate: 8.5, mortgageRate: 6.0, leaveReduction: 50. This diverges from the other
// sections of the same doc which use decimal rates — see the DecimalRate/PercentRate
// comment at the top of this file. PercentRate is retained here to match doc 07 exactly
// (DoD Gate 4.4). Unifying the convention is blocked on a spec decision.
export const DefaultsSchema = z
  .object({
    returnRate: PercentRate,
    inflationRate: PercentRate,
    salaryGrowth: PercentRate,
    extraContrib: Money,
    mortgageRate: PercentRate,
    mortgageTerm: z.number().int().min(10).max(40),
    propertyValue: Money.min(100_000),
    propertyGrowth: PercentRate,
    retirementTarget: Money.min(40_000),
    drawdownRate: PercentRate,
    targetRetAge: z.number().int().min(45).max(70),
    numChildren: z.number().int().min(0).max(5),
    childYear1: Year,
    childYear2: Year,
    childcareCost: Money,
    schoolCost: Money,
    leaveReduction: PercentRate,
  })
  .strict();

// ⚠ Migration/normalization boundary:
// The canonical `reference/Retirement_Dashboard_v2.html` CONFIG blob predates `schemaVersion`,
// and the literal + .strict() combination below will reject any raw legacy payload. Callers
// MUST run a normalizer (add `schemaVersion: 1`, strip legacy-only keys) BEFORE handing the
// blob to DashboardConfigSchema.parse(). Suggested location: `src/lib/config/loader.ts` with
// a single `parseConfig(raw: unknown)` that does: normalize → migrate → parse.
// Do not loosen this schema to `.passthrough()` as a shortcut — loss of strict validation
// here has high blast radius (every form/calc/migration consumes this type).
export const DashboardConfigSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    profile: ProfileSchema,
    debts: DebtsSchema,
    expenses: ExpensesSchema,
    property: PropertySchema,
    mortgage: MortgageSchema,
    familyProperty: FamilyPropertySchema,
    children: ChildrenSchema,
    defaults: DefaultsSchema,
  })
  .strict();

export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;
