export const SAMPLE_OFFER = `
OFFER TO PURCHASE

Property: 148 Commonwealth Avenue, Unit 4, Boston, MA 02116

Parcel: Suffolk County Parcel 05012345

Buyer: Elena Voss

Seller: Harbor & Pine LLC

Purchase Price: $350,000

Earnest Money Deposit: $10,000 due within 3 business days of acceptance, held by First American Title.

Financing: Buyer shall obtain a conventional mortgage of 80% of the purchase price. This offer is subject to a mortgage contingency expiring 21 days after acceptance.

Closing: November 15, 2026 at the offices of the seller's attorney, or by mail.

Inspection: Subject to a satisfactory home inspection within 10 days of acceptance. Buyer may terminate if the inspection is unsatisfactory.

Due Diligence: Buyer shall have a 10-day due diligence period to review condominium documents.

Appraisal: The purchase is contingent upon the property appraising for at least the purchase price.

Property Condition: Seller shall repair the leaking kitchen faucet prior to closing. Otherwise the property is sold as-is.

Included Items: Refrigerator, washer, and dryer are included in the sale.

Title: Seller shall convey good and clear record and marketable title by Massachusetts quitclaim deed.

Possession: Possession shall be delivered at closing, free of tenants.

Special Provisions: Sale of the buyer's current residence is not a contingency of this offer.

Dates: This offer expires October 20, 2026.
`.trim();

export const SAMPLE_PSA = `
PURCHASE AND SALE AGREEMENT

Property Address: 148 Commonwealth Avenue, Unit 4, Boston, Massachusetts 02116

Parcel ID: 05012345

Buyer: Elena Voss

Seller: Harbor and Pine LLC

Purchase Price: Three Hundred Fifty Thousand Dollars ($350,000)

Deposit: The earnest money deposit shall be Fifteen Thousand Dollars ($15,000), due within five (5) business days, held by Commonwealth Escrow LLC.

Financing: The transaction is a cash purchase. There is no mortgage contingency.

Closing Date: December 1, 2026. Closing shall occur at the registry of deeds.

Due Diligence: Buyer shall have ten (10) days to review condominium documents and may terminate during that period.

Property Condition: The property is sold strictly AS-IS, with no seller repairs.

Included Items: Refrigerator, washer, and dryer shall remain with the property.

Title and Deed: Seller shall deliver a quitclaim deed conveying marketable title.

Possession: Buyer shall be entitled to possession at the closing.

Assignment: Buyer may assign this agreement without seller approval.

Time: Time is of the essence.
`.trim();

/** A later PSA draft that changes the price and leaves the other sample conflicts in place. */
export const SAMPLE_PSA_REVISED = SAMPLE_PSA.replace(
  "Three Hundred Fifty Thousand Dollars ($350,000)",
  "Three Hundred Seventy-Five Thousand Dollars ($375,000)",
);
