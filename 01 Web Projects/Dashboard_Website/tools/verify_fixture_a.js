// Fixture A verification script
// Replicates the exact formulas from Retirement_Dashboard_v2.html
// Source functions: renderBudgetKPIs (line 1876), calcMortgageSchedule (line 2108), renderFamilyProperty (line 2160)

const CONFIG = {
  profile: {
    matty: { name: "Matty", age: 35, superBalance: 155000, salary: 196000, superRate: 0.14 },
    partner: { name: "Partner", age: 26, superBalance: 35000, salary: 86000 },
    currentYear: 2026,
    projectionYears: 35,
    preservationAge: 60,
    contribTaxRate: 0.15,
    concessionalCap: 30000
  },
  debts: {
    active: [
      { name: "Partner's Car", balance: 35000, payment: 681, rate: 0.08 },
      { name: "Toyota Hilux",  balance: 28000, payment: 582, rate: 0.08 },
      { name: "Now Finance",   balance: 25000, payment: 553, rate: 0.12 },
      { name: "OMM/wFinance",  balance: 17000, payment: 360, rate: 0.12 }
    ]
  },
  expenses: {
    fixed: [
      { category: "Rent (ELP Trust)", monthly: 3253 },
      { category: "Partner's Car Loan", monthly: 681 },
      { category: "Toyota Hilux Loan", monthly: 582 },
      { category: "Now Finance (Personal)", monthly: 553 },
      { category: "OMM/wFinance (Personal)", monthly: 360 },
      { category: "Health Insurance (AHM)", monthly: 298 },
      { category: "Car Insurance (RACQ)", monthly: 218 },
      { category: "Phone (Telstra)", monthly: 110 },
      { category: "Internet (Aussie BB)", monthly: 40 }
    ],
    variable: [
      { category: "Credit Card Payments (Qantas)", monthly: 6200 },
      { category: "Groceries & Household", monthly: 1554 },
      { category: "Dining & Takeaway", monthly: 827 },
      { category: "Shopping & Retail", monthly: 299 },
      { category: "Health & Wellness", monthly: 241 },
      { category: "Crypto (Digital Surge)", monthly: 233 },
      { category: "AI Tools (Claude, OpenAI, Perplexity, Cline)", monthly: 225 },
      { category: "Fuel", monthly: 181 },
      { category: "Software (Apple, Google, Microsoft, Adobe)", monthly: 142 },
      { category: "Streaming & Subscriptions", monthly: 139 },
      { category: "Clothing & Outdoors", monthly: 109 },
      { category: "Pets (Vet, Petstock)", monthly: 95 },
      { category: "Transport (Tolls, Parking, Rides)", monthly: 48 },
      { category: "Travel & Accommodation (Flights, Airbnb, Hipcamp)", monthly: 100 }
    ]
  },
  familyProperty: {
    purchasePrice: 1300000,
    currentValue: 2400000,
    ownershipShare: 0.333,
    weeklyRent: 2300,
    growthRate: 0.04,
    loans: {
      mortgage: 1100000,
      equityLoan: 297999,
      mortgageTerms: { rate: 0.056, totalTerm: 30, ioPeriod: 5, mode: "io-then-pi" }
    },
    parents: { parent1Age: 65, parent2Age: 63, lifeExpectancy1: 85, lifeExpectancy2: 87 }
  }
};

// ==========================================================
// BUDGET KPIs — exact port of renderBudgetKPIs (line 1876)
// ==========================================================
function calcBudgetKPIs() {
  const E = CONFIG.expenses;
  const D = CONFIG.debts;
  const mattyFn = 5298;
  const partnerFn = 2982;
  const mattyMo = Math.round(mattyFn * 26 / 12);
  const partnerMo = Math.round(partnerFn * 26 / 12);
  const combinedMo = mattyMo + partnerMo;
  const combinedWk = Math.round(combinedMo * 12 / 52);
  const combinedYr = combinedMo * 12;

  const fixedTotal = E.fixed.reduce((s, e) => s + e.monthly, 0);
  const varAll = E.variable.reduce((s, e) => s + e.monthly, 0);
  const ccPayments = E.variable
    .filter(e => /credit card/i.test(e.category))
    .reduce((s, e) => s + e.monthly, 0);
  const varExCC = varAll - ccPayments;
  const totalSpend = fixedTotal + varExCC;
  const totalSpendWk = Math.round(totalSpend * 12 / 52);

  const debtCount = D.active.length;
  const totalDebtPmt = D.active.reduce((s, d) => s + d.payment, 0);
  const totalDebtBal = D.active.reduce((s, d) => s + d.balance, 0);

  const surplus = combinedMo - totalSpend;
  const surplusWk = Math.round(surplus * 12 / 52);
  const savingsRate = combinedMo > 0 ? ((surplus / combinedMo) * 100) : 0;

  return {
    mattyFn, partnerFn, mattyMo, partnerMo, combinedMo, combinedWk, combinedYr,
    fixedTotal, varAll, ccPayments, varExCC, totalSpend, totalSpendWk,
    debtCount, totalDebtPmt, totalDebtBal,
    surplus, surplusWk, savingsRate
  };
}

// ==========================================================
// MORTGAGE AMORTISATION — exact port of calcMortgageSchedule (line 2108)
// ==========================================================
function calcMortgageSchedule(principal, annualRate, totalTerm, ioPeriod, mode) {
  const monthlyRate = annualRate / 12;
  const schedule = [];
  let balance = principal;
  const ioYears = mode === 'full-pi' ? 0 : ioPeriod;
  const piYears = totalTerm - ioYears;
  const piMonths = piYears * 12;

  for (let yr = 1; yr <= totalTerm; yr++) {
    let yearInterest = 0, yearPrincipal = 0, yearPayment = 0;
    if (yr <= ioYears) {
      const monthlyIO = balance * monthlyRate;
      yearInterest = monthlyIO * 12;
      yearPayment = yearInterest;
    } else {
      const monthsElapsedInPI = (yr - ioYears - 1) * 12;
      const monthsRemainingAtStartOfYear = piMonths - monthsElapsedInPI;
      if (monthsRemainingAtStartOfYear <= 0 || balance <= 0) {
        schedule.push({ year: yr, payment: 0, interest: 0, principal: 0, balance: 0 });
        continue;
      }
      const monthlyPI = balance * (monthlyRate * Math.pow(1 + monthlyRate, monthsRemainingAtStartOfYear))
                        / (Math.pow(1 + monthlyRate, monthsRemainingAtStartOfYear) - 1);
      for (let m = 0; m < 12; m++) {
        if (balance <= 0) break;
        const intPart = balance * monthlyRate;
        const prinPart = Math.min(monthlyPI - intPart, balance);
        yearInterest += intPart;
        yearPrincipal += prinPart;
        balance = Math.max(0, balance - prinPart);
      }
      yearPayment = yearInterest + yearPrincipal;
    }
    schedule.push({
      year: yr,
      payment: Math.round(yearPayment),
      interest: Math.round(yearInterest),
      principal: Math.round(yearPrincipal),
      balance: Math.round(balance)
    });
  }
  return schedule;
}

// ==========================================================
// FAMILY PROPERTY — exact port of renderFamilyProperty (line 2160)
// Generates 30-year projection with equity-loan paydown
// ==========================================================
function calcFamilyPropertyProjection() {
  const FP = CONFIG.familyProperty;
  const P = CONFIG.profile;
  const currentYear = P.currentYear;
  const mattyAge0 = P.matty.age;
  const growth = FP.growthRate;
  const share = FP.ownershipShare;
  const annualRent = FP.weeklyRent * 52;
  const totalLoans0 = FP.loans.mortgage + FP.loans.equityLoan;
  const MT = FP.loans.mortgageTerms;
  const mtgSchedule = calcMortgageSchedule(
    FP.loans.mortgage, MT.rate, MT.totalTerm, MT.ioPeriod, MT.mode
  );

  // Static KPIs
  const monthlyIO = Math.round((FP.loans.mortgage * MT.rate) / 12);
  const piStartYr = MT.ioPeriod + 1;
  const annualMtgPaymentPI = mtgSchedule[piStartYr - 1].payment;
  const monthlyPI = Math.round(annualMtgPaymentPI / 12);
  const capitalGain = FP.currentValue - FP.purchasePrice;
  const capitalGainPct = (capitalGain / FP.purchasePrice) * 100;
  const lvr = (totalLoans0 / FP.currentValue) * 100;
  const netPropertyValue0 = FP.currentValue - totalLoans0;
  const grossEquity0 = FP.currentValue * share;
  const netEquity0 = netPropertyValue0 * share;
  const rentalYield = (annualRent / FP.currentValue) * 100;
  const yourRentShare = annualRent * share;

  // Inheritance
  const p1Remaining = FP.parents.lifeExpectancy1 - FP.parents.parent1Age;
  const p2Remaining = FP.parents.lifeExpectancy2 - FP.parents.parent2Age;
  const inheritYearsFromNow = Math.max(p1Remaining, p2Remaining);
  const inheritYear = currentYear + inheritYearsFromNow;
  const inheritAge = mattyAge0 + inheritYearsFromNow;
  const inheritValue = FP.currentValue * Math.pow(1 + growth, inheritYearsFromNow);

  // Year-by-year projection (0..30)
  const projYears = 30;
  const rows = [];
  let cumRent = 0;
  let remEquity = FP.loans.equityLoan;

  for (let y = 0; y <= projYears; y++) {
    const year = currentYear + y;
    const val = FP.currentValue * Math.pow(1 + growth, y);
    const rentGross = annualRent * Math.pow(1.03, y);
    let remMortgage;
    if (y === 0) remMortgage = FP.loans.mortgage;
    else if (y <= mtgSchedule.length) remMortgage = mtgSchedule[y - 1].balance;
    else remMortgage = 0;
    const mtgPayThisYear = (y >= 1 && y <= mtgSchedule.length) ? mtgSchedule[y - 1].payment : 0;
    const opex = rentGross * 0.15;
    const surplus = Math.max(0, rentGross - mtgPayThisYear - opex);
    const eqPay = Math.min(remEquity, surplus);
    remEquity = Math.max(0, remEquity - eqPay);
    const remainingLoans = remMortgage + remEquity;
    const netVal = val - remainingLoans;
    const netEq = netVal * share;
    const rentYou = rentGross * share;
    if (y > 0) cumRent += rentYou;
    const p1Age = FP.parents.parent1Age + y;
    const p2Age = FP.parents.parent2Age + y;
    const mattyAge = mattyAge0 + y;
    let phase = '';
    if (y >= 1 && y <= mtgSchedule.length && remMortgage > 0) {
      phase = y <= MT.ioPeriod ? 'IO' : 'P&I';
    }
    rows.push({
      year, mattyAge, p1Age, p2Age,
      propValue: Math.round(val),
      mortgage: Math.round(remMortgage),
      equityLoan: Math.round(remEquity),
      totalLoans: Math.round(remainingLoans),
      netEquity: Math.round(netEq),
      rentGross: Math.round(rentGross),
      yourRent: Math.round(rentYou),
      cumRent: Math.round(cumRent),
      mtgPayment: Math.round(mtgPayThisYear),
      phase
    });
  }

  return {
    statics: {
      monthlyIO, monthlyPI, capitalGain, capitalGainPct,
      totalLoans0, lvr, netPropertyValue0, grossEquity0, netEquity0,
      annualRent, rentalYield, yourRentShare,
      inheritYear, inheritAge, inheritValue: Math.round(inheritValue)
    },
    mtgSchedule,
    projection: rows
  };
}

// ==========================================================
// EXECUTE
// ==========================================================
const budget = calcBudgetKPIs();
const family = calcFamilyPropertyProjection();

console.log('='.repeat(70));
console.log('FIXTURE A VERIFICATION — MATTY & PARTNER');
console.log('='.repeat(70));
console.log();
console.log('BUDGET KPIs');
console.log('-'.repeat(70));
Object.entries(budget).forEach(([k, v]) => {
  const val = typeof v === 'number' ? v.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : v;
  console.log(`  ${k.padEnd(20)} : ${val}`);
});
console.log();
console.log('FAMILY PROPERTY — STATIC KPIs');
console.log('-'.repeat(70));
Object.entries(family.statics).forEach(([k, v]) => {
  const val = typeof v === 'number' ? v.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : v;
  console.log(`  ${k.padEnd(22)} : ${val}`);
});
console.log();
console.log('MORTGAGE SCHEDULE (30 years)');
console.log('-'.repeat(70));
console.log('Yr  Payment    Interest   Principal  Balance');
family.mtgSchedule.forEach(r => {
  console.log(
    String(r.year).padStart(2) + '  ' +
    String(r.payment).padStart(9) + '  ' +
    String(r.interest).padStart(9) + '  ' +
    String(r.principal).padStart(9) + '  ' +
    String(r.balance).padStart(9)
  );
});
console.log();
console.log('FAMILY PROPERTY 30-YEAR PROJECTION');
console.log('-'.repeat(100));
console.log('Year  MAge  Parents   PropValue    Mortgage    EqLoan    TotalDebt   NetEquity   YourRent    Phase');
family.projection.forEach(r => {
  console.log(
    String(r.year).padStart(4) + '  ' +
    String(r.mattyAge).padStart(4) + '  ' +
    (r.p1Age + '/' + r.p2Age).padEnd(8) + '  ' +
    String(r.propValue).padStart(10) + '  ' +
    String(r.mortgage).padStart(10) + '  ' +
    String(r.equityLoan).padStart(8) + '  ' +
    String(r.totalLoans).padStart(10) + '  ' +
    String(r.netEquity).padStart(10) + '  ' +
    String(r.yourRent).padStart(9) + '  ' +
    r.phase
  );
});
console.log();
console.log('KEY YEAR SNAPSHOTS (for doc 10 table)');
console.log('-'.repeat(70));
[0, 4, 9, 14, 19, 24, 29].forEach(i => {
  const r = family.projection[i];
  console.log(`  ${r.year} (yr ${i}): PropVal=${r.propValue}, Mtg=${r.mortgage}, EqLoan=${r.equityLoan}, NetEq=${r.netEquity}`);
});
