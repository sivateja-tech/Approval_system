// src/utils/requestNumber.util.js
//
// Format:  FR-{DEPTCODE}-{YYYYMMDD}-{5-digit sequence}
// Example: FR-IT-20240606-00001
//          FR-HR-20240606-00042
//
// Collision safety:
//   • The sequence number is derived by counting how many requests already
//     exist for that dept+date combination and adding 1.
//   • The count query and the request creation happen inside the SAME
//     Prisma transaction in request.service.js — pass `tx` (the transaction
//     client) here so the sequence is always accurate even under concurrent
//     submissions.
//   • In the unlikely event two concurrent transactions pick the same number
//     before either commits, the `requestNumber @unique` constraint on
//     FundRequest acts as the final safety net and the DB will reject the
//     duplicate with a unique-constraint error, which the caller can retry.

'use strict';

const generateRequestNumber = async (tx, deptCode) => {
  if (!tx)   throw new Error('generateRequestNumber requires a Prisma transaction client (tx)');
  if (!deptCode?.trim()) throw new Error('generateRequestNumber requires a department code');

  const code = deptCode.trim().toUpperCase();

  // Build the date prefix: YYYYMMDD in local time
  const now   = new Date();
  const yyyy  = now.getFullYear();
  const mm    = String(now.getMonth() + 1).padStart(2, '0');
  const dd    = String(now.getDate()).padStart(2, '0');
  const date  = `${yyyy}${mm}${dd}`;

  // The pattern we search for: FR-IT-20240606-%
  const pattern = `FR-${code}-${date}-`;

  // Count existing requests with the same dept+date prefix
  const count = await tx.fundRequest.count({
    where: {
      requestNumber: { startsWith: pattern },
    },
  });

  // Sequence is count+1, zero-padded to 5 digits (supports up to 99,999/dept/day)
  const seq = String(count + 1).padStart(5, '0');

  return `${pattern}${seq}`;
};

module.exports = { generateRequestNumber };