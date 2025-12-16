/**
 * Identity Service Provider Interface (SPI)
 * Defines the contract for authentication and authorization
 * 
 * Mirrors EDC's IdentityService pattern for multi-tenant authentication
 * 
 * @interface IdentityService
 */

/**
 * User model
 * @typedef {Object} User
 * @property {number} id - User ID
 * @property {string} username - Username
 * @property {string} connectorId - Connector/tenant identifier
 * @property {string} displayName - Display name
 * @property {boolean} isActive - Active status
 */

/**
 * Authentication result
 * @typedef {Object} AuthenticationResult
 * @property {boolean} success - Authentication success
 * @property {User} [user] - User information if successful
 * @property {string} [token] - JWT token if successful
 * @property {string} [error] - Error message if failed
 */

/**
 * Interface for user storage operations
 */
class UserStore {
  /**
   * Find user by username
   * @param {string} username - Username to search
   * @returns {Promise<User|null>}
   */
  async findByUsername(username) {
    throw new Error('Not implemented');
  }

  /**
   * Find user by ID
   * @param {number} userId - User ID
   * @returns {Promise<User|null>}
   */
  async findById(userId) {
    throw new Error('Not implemented');
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Promise<User>}
   */
  async create(userData) {
    throw new Error('Not implemented');
  }

  /**
   * Update user
   * @param {number} userId - User ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<User>}
   */
  async update(userId, updates) {
    throw new Error('Not implemented');
  }
}

/**
 * Identity Service for authentication and authorization
 * Following EDC IdentityService pattern
 */
class IdentityService {
  /**
   * @param {UserStore} userStore - User store implementation
   * @param {Object} jwtService - JWT token service
   */
  constructor(userStore, jwtService) {
    this.userStore = userStore;
    this.jwtService = jwtService;
  }

  /**
   * Authenticate user with credentials
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<AuthenticationResult>}
   */
  async authenticate(username, password) {
    throw new Error('Not implemented');
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Promise<User|null>}
   */
  async verifyToken(token) {
    throw new Error('Not implemented');
  }

  /**
   * Get current user context
   * Used by other extensions to get tenant/owner information
   * @param {Object} request - HTTP request object
   * @returns {Promise<User|null>}
   */
  async getCurrentUser(request) {
    throw new Error('Not implemented');
  }

  /**
   * Check if user has permission for resource
   * @param {User} user - User to check
   * @param {string} resource - Resource identifier
   * @param {string} action - Action to perform
   * @returns {Promise<boolean>}
   */
  async hasPermission(user, resource, action) {
    throw new Error('Not implemented');
  }
}

module.exports = {
  UserStore,
  IdentityService
};
