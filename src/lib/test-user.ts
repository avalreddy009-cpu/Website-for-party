/** One seeded guest so LOGIN can be tried without a real inbox. */
export const TEST_USER = {
  email: "test@avionproductions.in",
  code: "123456",
  name: "Test Guest",
  phone: "9999999999",
  passId: "early" as const,
  quantity: 1,
  orderId: "seed-test-buyer",
  reference: "UTP-TEST-GUE1",
} as const;

export function isTestUserEmail(email: string): boolean {
  return email.trim().toLowerCase() === TEST_USER.email;
}

export function isTestUserCode(email: string, code: string): boolean {
  return isTestUserEmail(email) && code.replace(/\D/g, "") === TEST_USER.code;
}
