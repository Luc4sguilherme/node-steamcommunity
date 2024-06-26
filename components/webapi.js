var SteamCommunity = require('../index.js');

const Helpers = require('./helpers.js');

SteamCommunity.prototype.getWebApiKey = function(domain, callback) {
	var self = this;
	this.httpRequest({
		"uri": "https://steamcommunity.com/dev/apikey?l=english",
		"followRedirect": false
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if(body.match(/<h2>Access Denied<\/h2>/)) {
			return callback(new Error("Access Denied"));
		}

		if(body.match(/You must have a validated email address to create a Steam Web API key./)) {
			return callback(new Error("You must have a validated email address to create a Steam Web API key."));
		}

		var match = body.match(/<p>Key: ([0-9A-F]+)<\/p>/);
		if(match) {
			// We already have an API key registered
			callback(null, match[1]);
		} else {
			// We need to register a new API key
			self.httpRequestPost('https://steamcommunity.com/dev/registerkey?l=english', {
				"form": {
					"domain": domain,
					"agreeToTerms": "agreed",
					"sessionid": self.getSessionID(),
					"Submit": "Register"
				}
			}, function(err, response, body) {
				if (err) {
					callback(err);
					return;
				}

				self.getWebApiKey(domain, callback);
			}, "steamcommunity");
		}
	}, "steamcommunity");
};

/**
 * @deprecated No longer works. Will be removed in a future release.
 * @param {function} callback
 */
SteamCommunity.prototype.getWebApiOauthToken = function(callback) {
	if (this.oAuthToken) {
		return callback(null, this.oAuthToken);
	}

	callback(new Error('This operation requires an OAuth token, which is no longer issued by Steam.'));
};

/**
 * Sets an access_token generated by steam-session using EAuthTokenPlatformType.MobileApp.
 * Required for some operations such as 2FA enabling and disabling.
 * This will throw an Error if the provided token is not valid, was not generated for the MobileApp platform, is expired,
 * or does not belong to the logged-in user account.
 *
 * @param {string} token
 */
SteamCommunity.prototype.setMobileAppAccessToken = function(token) {
	if (!this.steamID) {
		throw new Error('Log on to steamcommunity before setting a mobile app access token');
	}

	let decodedToken = Helpers.decodeJwt(token);

	if (!decodedToken.iss || !decodedToken.sub || !decodedToken.aud || !decodedToken.exp) {
		throw new Error('Provided value is not a valid Steam access token');
	}

	if (decodedToken.iss == 'steam') {
		throw new Error('Provided token is a refresh token, not an access token');
	}

	if (decodedToken.sub != this.steamID.getSteamID64()) {
		throw new Error(`Provided token belongs to account ${decodedToken.sub}, but we are logged into ${this.steamID.getSteamID64()}`);
	}

	if (decodedToken.exp < Math.floor(Date.now() / 1000)) {
		throw new Error('Provided token is expired');
	}

	if ((decodedToken.aud || []).indexOf('mobile') == -1) {
		throw new Error('Provided token is not valid for MobileApp platform type');
	}

	this.mobileAccessToken = token;
};

/**
 * Verifies that the mobile access token we already have set is still valid for current login.
 *
 * @private
 */
SteamCommunity.prototype._verifyMobileAccessToken = function() {
	if (!this.mobileAccessToken) {
		// No access token, so nothing to do here.
		return;
	}

	let decodedToken = Helpers.decodeJwt(this.mobileAccessToken);

	let isTokenInvalid = decodedToken.sub != this.steamID.getSteamID64()    // SteamID doesn't match
		|| decodedToken.exp < Math.floor(Date.now() / 1000);                      // Token is expired

	if (isTokenInvalid) {
		delete this.mobileAccessToken;
	}
};
