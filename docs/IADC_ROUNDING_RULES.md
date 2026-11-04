# IADC WellSharp Rounding Rules Implementation

This document details the International Association of Drilling Contractors (**IADC WellSharp**) rounding rules and their implementation across the **5KR Kill Sheet** calculation engine.

---

## 1. Overview & Operational Safety Principles

In well control operations and IADC certification standards, standard mathematical rounding (round to nearest) is intentionally **not** applied to certain critical parameters. Directional rounding rules are strictly enforced to preserve operational safety margins:

1. **Hydrostatic Safety Margin (Underbalance Prevention):** Mud weights and circulating pressures are rounded **UP** to guarantee the well never falls below formation pore pressure.
2. **Fracture Safety Margin (Shoe Breakdown Prevention):** Formation integrity limits, leak-off test equivalent mud weights, and maximum allowable surface pressures are rounded **DOWN** to guarantee surface pressure never exceeds formation fracture strength at the casing shoe.
3. **Carry Forward Rule:** When a calculated value (such as Kill Mud Weight or Maximum Allowable Mud Weight) is used in subsequent equations on the kill sheet, the **already-rounded value must be carried forward** into all downstream formulas, not the unrounded raw number.

---

## 2. Official IADC Rounding Rules Summary

| Parameter | IADC Formula | Field Units Rule | Metric Units Rule | Operational Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Kill Mud Weight (KMW)** | $\text{MW} + \frac{\text{SIDPP}}{0.052 \times \text{TVD}}$ | **ROUND UP** to **0.1 ppg** | **ROUND UP** to **0.01 kg/L** (or whole $\text{kg/m}^3$) | Prevents formation kick from continuing to flow |
| **LOT / EMW / MAMW** | $\text{Test MW} + \frac{\text{Surface LOT}}{0.052 \times \text{Shoe TVD}}$ | **ROUND DOWN** to **0.1 ppg** | **ROUND DOWN** to **0.01 kg/L** | Prevents overestimating shoe fracture strength |
| **MAASP** | $(\text{MAMW} - \text{MW}) \times 0.052 \times \text{Shoe TVD}$ | **ROUND DOWN** to **whole psi** | **ROUND DOWN** to **0.1 bar** (or whole kPa) | Upper surface limit to protect open-hole shoe |
| **Initial Circulating Pressure (ICP)** | $\text{SIDPP} + \text{SCRP}$ | **Whole psi** | **0.1 bar** (or whole kPa) | Starting pump pressure at kill rate |
| **Final Circulating Pressure (FCP)** | $\text{SCRP} \times \frac{\text{KMW}}{\text{MW}}$ | **ROUND UP** to **whole psi** | **0.1 bar** (or whole kPa) | Preserves overbalance with kill mud at bit |
| **Pressure Drop per 100 Strokes** | $\frac{(\text{ICP} - \text{FCP}) \times 100}{\text{Strokes to Bit}}$ | **ROUND DOWN** to **whole psi/100 stks** | **ROUND DOWN** to **0.01 bar/100 stks** | Wait & Weight drill pipe step-down schedule |
| **Strokes (Bit / Annulus / Total)** | $\frac{\text{Volume}}{\text{Pump Output}}$ | **Nearest whole stroke** | **Nearest whole stroke** | Complete displacement tracking |

---

## 3. Project Calculation Adjustments

### A. Kill Mud Weight (KMW)
* **Code Implementation:**
  ```javascript
  const rawKmw = f.mw + f.sidpp / (0.052 * (tvd || 1));
  const kmw = Math.ceil((rawKmw - 1e-9) * 10) / 10;
  ```
* **Guard:** An epsilon (`1e-9`) is subtracted before `Math.ceil` to avoid floating-point representation anomalies where exact decimals (e.g., `13.000000000000002`) would incorrectly increment.

### B. Leak-Off Test & Maximum Allowable Mud Weight (MAMW)
* **Before:** `mamw` was unrounded floating-point math (e.g., $12.4 + 1149 / (0.052 \times 6500) = 15.7994\dots\text{ ppg}$, which standard mathematical display rounded to $15.8\text{ ppg}$).
* **After:**
  ```javascript
  const rawMamw = f.strength === 'lot' ? f.lotMw + f.lotP / (0.052 * (shoeTvd || 1))
                : f.strength === 'fg'  ? f.fg / 0.052
                : f.mamwIn;
  const mamw = Math.floor((rawMamw + 1e-9) * 10) / 10;
  ```
  Strictly truncated/rounded down to `15.7 ppg` per IADC mandate.

### C. Maximum Allowable Annular Surface Pressure (MAASP)
* **Before:** Calculated using the unrounded MAMW: $(15.7994 - 12.4) \times 0.052 \times 6500 = 1148.99\dots \approx 1149\text{ psi}$.
* **After:** Carries forward rounded `mamw = 15.7 ppg`, and truncates down to whole psi:
  ```javascript
  const rawMaasp = (mamw - f.mw) * 0.052 * shoeTvd;
  const maasp = Math.floor(rawMaasp + 1e-9);
  ```
  Result: $(15.7 - 12.4) \times 0.052 \times 6500 = 1115.4 \rightarrow \mathbf{1115\text{ psi}}$.
  This represents a **$34\text{ psi}$ safety buffer**, preventing shoe breakdown.

### D. Final Circulating Pressure (FCP)
* **Before:** Unrounded float, displayed using standard nearest-integer formatting.
* **After:** Uses rounded KMW and is rounded **UP** to the nearest whole psi:
  ```javascript
  const rawFcp = f.scrp * kmw / (f.mw || 1);
  const fcp = Math.ceil(rawFcp - 1e-9);
  ```

### E. Wait & Weight Pressure Reduction Schedule
* **Implementation:**
  ```javascript
  const prPer100 = Math.floor(((icp - fcp) * 100 / (sBit || 1)) + 1e-9);
  const prPerStep = Math.floor(((icp - fcp) / 10) + 1e-9);
  ```
* Exposed in:
  - Pressures table (`groups(c)`)
  - Schedule view helper note (`schedNote`)
  - Exported CSV header
  - Printable kill sheet PDF

---

## 4. Verification & Testing

Run the test suite using Node.js:
```bash
node tests/test_iadc_calculations.js
```

To re-bundle the project into `src/index.html` after editing `src/component.js`:
```bash
python3 scripts/build_bundle.py
```
