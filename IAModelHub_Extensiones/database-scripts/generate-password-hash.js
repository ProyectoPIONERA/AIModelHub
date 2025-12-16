#!/usr/bin/env node
/**
 * Password Hash Generator for IAModelHub (CatalogModelIA_DS reorganized)
 * 
 * This utility generates bcrypt password hashes for user accounts.
 * Use this when creating new users or changing passwords.
 * 
 * Usage:
 *   node generate-password-hash.js <password>
 *   node generate-password-hash.js           (interactive mode)
 * 
 * Examples:
 *   node generate-password-hash.js mySecurePassword123
 *   node generate-password-hash.js
 * 
 * The generated hash can be inserted into the users table:
 *   UPDATE users SET password_hash = '<generated-hash>' WHERE username = 'user-name';
 */

const bcrypt = require('bcryptjs');
const readline = require('readline');

// Configuration
const SALT_ROUNDS = 10; // bcrypt cost factor (10 = ~10 hashes/sec, secure default)

/**
 * Generate bcrypt hash for a password
 */
async function generateHash(password) {
  if (!password || password.length < 6) {
    console.error('❌ Error: Password must be at least 6 characters long');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('❌ Error generating hash:', error.message);
    process.exit(1);
  }
}

/**
 * Interactive mode - prompts user for password
 */
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter password to hash: ', (password) => {
      rl.close();
      resolve(password);
    });
  });
}

/**
 * Verify a password against a hash
 */
async function verifyHash(password, hash) {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('❌ Error verifying hash:', error.message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔐 IAModelHub Password Hash Generator\n');

  let password;

  // Get password from command line argument or interactive mode
  if (process.argv[2]) {
    password = process.argv[2];
  } else {
    password = await interactiveMode();
  }

  // Trim whitespace
  password = password.trim();

  // Generate hash
  console.log('Generating bcrypt hash...\n');
  const hash = await generateHash(password);

  // Display results
  console.log('✅ Hash generated successfully!\n');
  console.log('━'.repeat(80));
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('━'.repeat(80));
  console.log('\nSQL UPDATE Example:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'your-username';`);
  console.log('\nSQL INSERT Example:');
  console.log(`INSERT INTO users (username, password_hash, connector_id, display_name)`);
  console.log(`VALUES ('new-user', '${hash}', 'conn-new-user', 'New User');`);
  console.log('━'.repeat(80));

  // Verify the hash works
  console.log('\n🔍 Verifying hash...');
  const isValid = await verifyHash(password, hash);
  if (isValid) {
    console.log('✅ Hash verification successful! The hash is valid.\n');
  } else {
    console.log('❌ Hash verification failed! Something went wrong.\n');
  }

  // Security reminder
  console.log('⚠️  SECURITY REMINDERS:');
  console.log('  • Use strong passwords in production (12+ characters, mixed case, numbers, symbols)');
  console.log('  • Never commit passwords to version control');
  console.log('  • Store this hash securely until inserted into database');
  console.log('  • Change default passwords immediately after deployment\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

// Export for testing or programmatic use
module.exports = { generateHash, verifyHash };
