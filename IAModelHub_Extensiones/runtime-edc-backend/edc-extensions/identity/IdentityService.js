/**
 * Identity Service
 * Manages user authentication and multi-tenancy
 */
const bcrypt = require('bcryptjs');
const { generateToken } = require('../../src/middleware/auth');

class IdentityService {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Authenticate user and generate JWT token
   */
  async authenticate(username, password) {
    const result = await this.pool.query(
      'SELECT id, username, password_hash, connector_id, display_name, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new Error('Account disabled');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        connectorId: user.connector_id,
        displayName: user.display_name
      }
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const result = await this.pool.query(
      'SELECT id, username, connector_id, display_name FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user by connector ID
   */
  async getUserByConnectorId(connectorId) {
    const result = await this.pool.query(
      'SELECT id, username, connector_id, display_name FROM users WHERE connector_id = $1',
      [connectorId]
    );
    return result.rows[0] || null;
  }
}

module.exports = { IdentityService };
