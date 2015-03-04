var log = require('./log');

/**
 * New Relic agent configuration.
 *
 * See lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */

// New Relic defaults to enabled. We want the opposite.
if (!process.env['NEW_RELIC_ENABLED']) {
    process.env['NEW_RELIC_ENABLED'] = 'false';
} else {
    log.info('New Relic is enabled');
}

exports.config = {
  /**
   * Array of application names.
   */
  app_name : [process.env['NEW_RELIC_APP_NAME'] || 'ImageSquish'],
  /**
   * Your New Relic license key.
   */
  license_key : process.env['NEW_RELIC_LICENSE_KEY'],
  logging : {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level : process.env['NEW_RELIC_LOG_LEVEL'] || 'info'
  }
};
