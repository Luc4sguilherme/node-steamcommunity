const Cheerio = require('cheerio');
const Crypto = require('crypto');
const imageSize = require('image-size');
const SteamID = require('steamid');

const SteamCommunity = require('../index.js');

const CEconItem = require('../classes/CEconItem.js');
const Helpers = require('./helpers.js');

SteamCommunity.prototype.addFriend = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/AddFriendAjax",
		"form": {
			"accept_invite": 0,
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.success) {
			callback(null);
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.acceptFriendRequest = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/AddFriendAjax",
		"form": {
			"accept_invite": 1,
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.removeFriend = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/RemoveFriendAjax",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.removeFriends = function (friends, callback) {
	if (!Array.isArray(friends)) {
		throw new Error("The friends must be an array.")
	}

	friends = friends.map(friend => {
		if (friend instanceof SteamID) {
			return friend.getSteamID64();
		}

		return friend;
	})

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/profiles/" + self.steamID.getSteamID64() + "/friends/action",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": self.steamID.getSteamID64(),
			"action": "remove",
			"ajax": "1",
			"steamids[]": friends
		},
		"headers": {
			"Origin": "https://steamcommunity.com",
			"Referer": "https://steamcommunity.com/profiles/" + self.steamID.getSteamID64() + "/friends/",
		},
	}, function (err, response, body) {
		if (!callback) {
			return;
		}

		if (body.success) {
			callback(null);
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.blockCommunication = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/BlockUserAjax",
		"form": {
			"sessionID": this.getSessionID(),
			"steamid": userID.toString()
		}
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		callback(err || null);
	}, "steamcommunity");
};

SteamCommunity.prototype.unblockCommunication = function(userID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var form = {"action": "unignore"};
	form['friends[' + userID.toString() + ']'] = 1;

	this._myProfile('friends/blocked/', form, function(err, response, body) {
		if(!callback) {
			return;
		}

		if(err || response.statusCode >= 400) {
			callback(err || new Error("HTTP error " + response.statusCode));
			return;
		}

		callback(null);
	});
};

SteamCommunity.prototype.postUserComment = function(userID, message, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/comment/Profile/post/" + userID.toString() + "/-1",
		"form": {
			"comment": message,
			"count": 1,
			"sessionid": this.getSessionID()
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.success) {
			const $ = Cheerio.load(body.comments_html);
			const commentID = $('.commentthread_comment').attr('id').split('_')[1];

			callback(null, commentID);
		} else if(body.error) {
			callback(new Error(body.error));
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.deleteUserComment = function(userID, commentID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/comment/Profile/delete/" + userID.toString() + "/-1",
		"form": {
			"gidcomment": commentID,
			"start": 0,
			"count": 1,
			"sessionid": this.getSessionID(),
			"feature2": -1
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.success && !body.comments_html.includes(commentID)) {
			callback(null);
		} else if(body.error) {
			callback(new Error(body.error));
		} else if(body.comments_html.includes(commentID)) {
			callback(new Error("Failed to delete comment"));
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserComments = function(userID, options, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	var form = Object.assign({
		"start": 0,
		"count": 0,
		"feature2": -1,
		"sessionid": this.getSessionID()
	}, options);

	this.httpRequestPost({
		"uri": "https://steamcommunity.com/comment/Profile/render/" + userID.toString() + "/-1",
		"form": form,
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.success) {
			const $ = Cheerio.load(body.comments_html);
			const comments = $(".commentthread_comment.responsive_body_text[id]").map((i, elem) => {
				var $elem = $(elem),
					$commentContent = $elem.find(".commentthread_comment_text");
				return {
					id: $elem.attr("id").split("_")[1],
					author: {
						steamID: new SteamID("[U:1:" + $elem.find("[data-miniprofile]").data("miniprofile") + "]"),
						name: $elem.find("bdi").text(),
						avatar: $elem.find(".playerAvatar img[src]").attr("src"),
						state: $elem.find(".playerAvatar").attr("class").split(" ").pop()
					},
					date: new Date($elem.find(".commentthread_comment_timestamp").data("timestamp") * 1000),
					text: $commentContent.text().trim(),
					html: $commentContent.html().trim()
				}
			}).get();

			callback(null, comments, body.total_count);
		} else if(body.error) {
			callback(new Error(body.error));
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.inviteUserToGroup = function(userID, groupID, callback) {
	if(typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var self = this;
	this.httpRequestPost({
		"uri": "https://steamcommunity.com/actions/GroupInvite",
		"form": {
			"group": groupID.toString(),
			"invitee": userID.toString(),
			"json": 1,
			"sessionID": this.getSessionID(),
			"type": "groupInvite"
		},
		"json": true
	}, function(err, response, body) {
		if(!callback) {
			return;
		}

		if (err) {
			callback(err);
			return;
		}

		if(body.results == 'OK') {
			callback(null);
		} else if(body.results) {
			callback(new Error(body.results));
		} else {
			callback(new Error("Unknown error"));
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserAliases = function(userID, callback) {
	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	this.httpRequestGet({
		"uri": "https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/ajaxaliases",
		"json": true
	}, function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		if (typeof body !== 'object') {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, body.map(function(entry) {
			entry.timechanged = Helpers.decodeSteamTime(entry.timechanged);
			return entry;
		}));
	}, "steamcommunity");
};

/**
 * Get the background URL of user's profile.
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {function} callback
 */
SteamCommunity.prototype.getUserProfileBackground = function(userID, callback) {
	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	this.httpRequest("https://steamcommunity.com/profiles/" + userID.getSteamID64(), (err, response, body) => {
		if (err) {
			callback(err);
			return;
		}

		var $ = Cheerio.load(body);

		var $privateProfileInfo = $('.profile_private_info');
		if ($privateProfileInfo.length > 0) {
			callback(new Error($privateProfileInfo.text().trim()));
			return;
		}

		if ($('body').hasClass('has_profile_background')) {
			var backgroundUrl = $('div.profile_background_image_content').css('background-image');
			var matcher = backgroundUrl.match(/\(([^)]+)\)/);

			if (matcher.length != 2 || !matcher[1].length) {
				callback(new Error("Malformed response"));
			} else {
				callback(null, matcher[1]);
			}
		} else {
			callback(null, null);
		}
	}, "steamcommunity");
};

SteamCommunity.prototype.getUserInventoryContexts = function(userID, callback) {
	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	if (typeof userID === 'function') {
		callback = userID;
		userID = this.steamID;
	}

	if (!userID) {
		callback(new Error("No SteamID specified and not logged in"));
		return;
	}

	var self = this;
	this.httpRequest("https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/inventory/", function(err, response, body) {
		if (err) {
			callback(err);
			return;
		}

		var match = body.match(/var g_rgAppContextData = ([^\n]+);\r?\n/);
		if (!match) {
			var errorMessage = "Malformed response";

			if(body.match(/0 items in their inventory\./)){
				callback(null, {});
				return;
			}else if(body.match(/inventory is currently private\./)){
				errorMessage = "Private inventory";
			}else if(body.match(/profile\_private\_info/)){
				errorMessage = "Private profile";
			}

			callback(new Error(errorMessage));
			return;
		}

		var data;
		try {
			data = JSON.parse(match[1]);
		} catch(e) {
			callback(new Error("Malformed response"));
			return;
		}

		callback(null, data);
	}, "steamcommunity");
};

/**
 * Get the contents of a user's inventory context.
 * @deprecated Use getUserInventoryContents instead
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventory = function(userID, appID, contextID, tradableOnly, callback) {
	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var endpoint = "/profiles/" + userID.getSteamID64();
	get([], []);

	function get(inventory, currency, start) {
		self.httpRequest({
			"uri": "https://steamcommunity.com" + endpoint + "/inventory/json/" + appID + "/" + contextID,
			"headers": {
				"Referer": "https://steamcommunity.com" + endpoint + "/inventory"
			},
			"qs": {
				"start": start,
				"trading": tradableOnly ? 1 : undefined
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				callback(err);
				return;
			}

			if (!body || !body.success || !body.rgInventory || !body.rgDescriptions || !body.rgCurrency) {
				if (body) {
					callback(new Error(body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			var i;
			for (i in body.rgInventory) {
				if (!body.rgInventory.hasOwnProperty(i)) {
					continue;
				}

				inventory.push(new CEconItem(body.rgInventory[i], body.rgDescriptions, contextID));
			}

			for (i in body.rgCurrency) {
				if (!body.rgCurrency.hasOwnProperty(i)) {
					continue;
				}

				currency.push(new CEconItem(body.rgInventory[i], body.rgDescriptions, contextID));
			}

			if (body.more) {
				var match = response.request.uri.href.match(/\/(profiles|id)\/([^\/]+)\//);
				if(match) {
					endpoint = "/" + match[1] + "/" + match[2];
				}

				get(inventory, currency, body.more_start);
			} else {
				callback(null, inventory, currency);
			}
		}, "steamcommunity");
	}
};

/**
 * Get the contents of a user's inventory context.
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventoryContents = function(userID, appID, contextID, tradableOnly, language, callback) {
	if (typeof language === 'function') {
		callback = language;
		language = "english";
	}

	if (!userID) {
		callback(new Error("The user's SteamID is invalid or missing."));
		return;
	}

	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var pos = 1;
	get([], []);

	function get(inventory, currency, start) {
		self.httpRequest({
			"uri": "https://steamcommunity.com/inventory/" + userID.getSteamID64() + "/" + appID + "/" + contextID,
			"headers": {
				"Referer": "https://steamcommunity.com/profiles/" + userID.getSteamID64() + "/inventory"
			},
			"qs": {
				"l": language, // Default language
				"count": 2000, // Max items per 'page'
				"start_assetid": start
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				if (err.message == "HTTP error 403" && body === null) {
					// 403 with a body of "null" means the inventory/profile is private.
					if (self.steamID && userID.getSteamID64() == self.steamID.getSteamID64()) {
						// We can never get private profile error for our own inventory!
						self._notifySessionExpired(err);
					}

					callback(new Error("This profile is private."));
					return;
				}

				if (err.message == "HTTP error 500" && body && body.error) {
					err = new Error(body.error);

					var match = body.error.match(/^(.+) \((\d+)\)$/);
					if (match) {
						err.message = match[1];
						err.eresult = match[2];
						callback(err);
						return;
					}
				}

				callback(err);
				return;
			}

			if (body && body.success && body.total_inventory_count === 0) {
				// Empty inventory
				callback(null, [], [], 0);
				return;
			}

			if (!body || !body.success || !body.assets || !body.descriptions) {
				if (body) {
					// Dunno if the error/Error property even exists on this new endpoint
					callback(new Error(body.error || body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			for (var i = 0; i < body.assets.length; i++) {
				var description = getDescription(body.descriptions, body.assets[i].classid, body.assets[i].instanceid);

				if (!tradableOnly || (description && description.tradable)) {
					body.assets[i].pos = pos++;
					(body.assets[i].currencyid ? currency : inventory).push(new CEconItem(body.assets[i], description, contextID));
				}
			}

			if (body.more_items) {
				get(inventory, currency, body.last_assetid);
			} else {
				callback(null, inventory, currency, body.total_inventory_count);
			}
		}, "steamcommunity");
	}

	// A bit of optimization; objects are hash tables so it's more efficient to look up by key than to iterate an array
	var quickDescriptionLookup = {};

	function getDescription(descriptions, classID, instanceID) {
		var key = classID + '_' + (instanceID || '0'); // instanceID can be undefined, in which case it's 0.

		if (quickDescriptionLookup[key]) {
			return quickDescriptionLookup[key];
		}

		for (var i = 0; i < descriptions.length; i++) {
			quickDescriptionLookup[descriptions[i].classid + '_' + (descriptions[i].instanceid || '0')] = descriptions[i];
		}

		return quickDescriptionLookup[key];
	}
};

/**
 * Get the contents of a user's inventory context.
 * @param {string} apiKey - The steam web api key
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param {function} callback
 */
SteamCommunity.prototype.getInventoryItemsWithDescriptions = function(apiKey, userID, appID, contextID, tradableOnly, language, callback) {
	if (typeof language === 'function') {
		callback = language;
		language = "english";
	}

	if (!userID) {
		callback(new Error("The user's SteamID is invalid or missing."));
		return;
	}

	if (!apiKey) {
		callback(new Error("The apiKey is missing."));
		return;
	}

	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var pos = 1;
	get([], []);

	function get(inventory, currency, start) {
		self.httpRequest({
			"uri": "https://api.steampowered.com/IEconService/GetInventoryItemsWithDescriptions/v1",
			"qs": {
				"key": apiKey,
				"appid": appID,
				"contextid": contextID,
				"steamid": userID.getSteamID64(),
				"language": language,
				"start_assetid": start,
				"get_descriptions": true
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				if(err.message == "HTTP error 403") {
					callback(new Error("Invalid API key"));
					return;
				}

				callback(err);
				return;
			}

			if (body && body.response.total_inventory_count === 0) {
				// Empty inventory
				callback(null, [], [], 0);
				return;
			}

			if (!body || !body.response.assets || !body.response.descriptions) {
				if (body) {
					// Dunno if the error/Error property even exists on this new endpoint
					callback(new Error(body.error || body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			for (var i = 0; i < body.response.assets.length; i++) {
				var description = getDescription(body.response.descriptions, body.response.assets[i].classid, body.response.assets[i].instanceid);

				if (!tradableOnly || (description && description.tradable)) {
					body.response.assets[i].pos = pos++;
					(body.response.assets[i].currencyid ? currency : inventory).push(new CEconItem(body.response.assets[i], description, contextID));
				}
			}

			if (body.response.more_items) {
				get(inventory, currency, body.response.last_assetid);
			} else {
				callback(null, inventory, currency, body.response.total_inventory_count);
			}
		}, "steamcommunity");
	}

	// A bit of optimization; objects are hash tables so it's more efficient to look up by key than to iterate an array
	var quickDescriptionLookup = {};

	function getDescription(descriptions, classID, instanceID) {
		var key = classID + '_' + (instanceID || '0'); // instanceID can be undefined, in which case it's 0.

		if (quickDescriptionLookup[key]) {
			return quickDescriptionLookup[key];
		}

		for (var i = 0; i < descriptions.length; i++) {
			quickDescriptionLookup[descriptions[i].classid + '_' + (descriptions[i].instanceid || '0')] = descriptions[i];
		}

		return quickDescriptionLookup[key];
	}
};

/**
 * Get the contents of a user's inventory context.
 * @param {string} apiKey - The steamapis apikey
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventorySteamApis = function(apiKey, userID, appID, contextID, tradableOnly, language, callback) {
	if (typeof language === 'function') {
		callback = language;
		language = "english";
	}

	if (!userID) {
		callback(new Error("The user's SteamID is invalid or missing."));
		return;
	}

	if (!apiKey) {
		callback(new Error("The apiKey is missing."));
		return;
	}

	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var pos = 1;
	get([], []);

	function get(inventory, currency, start, retries = 5) {
		self.httpRequest({
			"uri": `https://api.steamapis.com/steam/inventory/${userID.getSteamID64()}/${appID}/${contextID}`,
			"qs": {
				"api_key": apiKey,
				"l": language,
				"count": 2000, // Max items per 'page'
				"start_assetid": start
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				if(err.message == "HTTP error 404" || body && body.error == "Could not retrieve user inventory. Please try again later.") {
					if(retries > 0) {
						get(inventory, currency, start, retries - 1)
						return
					}
				}

				if(err.message == "HTTP error 403") {
					callback(new Error("This profile is private."));
					return;
				}

				if(body && body.error) {
					callback(new Error(body.error))
					return;
				}

				callback(err);
				return;
			}

			if (body && body.success && body.total_inventory_count === 0) {
				// Empty inventory
				callback(null, [], [], 0);
				return;
			}

			if (!body || !body.success || !body.assets || !body.descriptions) {
				if (body) {
					// Dunno if the error/Error property even exists on this new endpoint
					callback(new Error(body.error || body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			for (var i = 0; i < body.assets.length; i++) {
				var description = getDescription(body.descriptions, body.assets[i].classid, body.assets[i].instanceid);

				if (!tradableOnly || (description && description.tradable)) {
					body.assets[i].pos = pos++;
					(body.assets[i].currencyid ? currency : inventory).push(new CEconItem(body.assets[i], description, contextID));
				}
			}

			if (body.more_items) {
				get(inventory, currency, body.last_assetid);
			} else {
				callback(null, inventory, currency, body.total_inventory_count);
			}
		}, "steamcommunity");
	}

	// A bit of optimization; objects are hash tables so it's more efficient to look up by key than to iterate an array
	var quickDescriptionLookup = {};

	function getDescription(descriptions, classID, instanceID) {
		var key = classID + '_' + (instanceID || '0'); // instanceID can be undefined, in which case it's 0.

		if (quickDescriptionLookup[key]) {
			return quickDescriptionLookup[key];
		}

		for (var i = 0; i < descriptions.length; i++) {
			quickDescriptionLookup[descriptions[i].classid + '_' + (descriptions[i].instanceid || '0')] = descriptions[i];
		}

		return quickDescriptionLookup[key];
	}
};

/**
 * Get the contents of a user's inventory context.
 * @param {string} apiKey - The steamsupply apikey
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventorySteamSupply = function(apiKey, userID, appID, contextID, tradableOnly, language, callback) {
	if (typeof language === 'function') {
		callback = language;
		language = "english";
	}

	if (!userID) {
		callback(new Error("The user's SteamID is invalid or missing."));
		return;
	}

	if (!apiKey) {
		callback(new Error("The apiKey is missing."));
		return;
	}

	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var pos = 1;
	get([], []);

	function get(inventory, currency, start, retries = 5) {
		self.httpRequest({
			"uri": `https://steam.supply/API/${apiKey}/loadinventory`,
			"qs": {
				"l": language,
				"steamid": userID.getSteamID64(),
				"appid": appID,
				"contextid": contextID,
				"count": 5000, // Max items per 'page'
				"start_assetid": start
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				if(err.message == "HTTP error 500") {
					if(retries > 0) {
						get(inventory, currency, start, retries - 1)
						return
					}
				}

				if(err.message == "HTTP error 403") {
					if(response.body && response.body.includes('Invalid API key')) {
						callback(new Error("Invalid API key"));
						return;
					}


					if(response.body && response.body.includes('Inventory Private')  ) {
						callback(new Error("This profile is private."));
						return;
					}
				}


				if(response && response.body) {
					callback(new Error(response.body))
					return;
				}

				callback(err);
				return;
			}

			if(typeof response.body != 'object' || response.body.fake_redirect) {
				if(retries > 0) {
					get(inventory, currency, start, retries - 1)
					return
				}
			}

			if (body && body.success && body.total_inventory_count === 0) {
				// Empty inventory
				callback(null, [], [], 0);
				return;
			}

			if (!body || !body.success || !body.assets || !body.descriptions) {
				if (body) {
					// Dunno if the error/Error property even exists on this new endpoint
					callback(new Error(body.error || body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			for (var i = 0; i < body.assets.length; i++) {
				var description = getDescription(body.descriptions, body.assets[i].classid, body.assets[i].instanceid);

				if (!tradableOnly || (description && description.tradable)) {
					body.assets[i].pos = pos++;
					(body.assets[i].currencyid ? currency : inventory).push(new CEconItem(body.assets[i], description, contextID));
				}
			}

			if (body.more_items) {
				get(inventory, currency, body.last_assetid);
			} else {
				callback(null, inventory, currency, body.total_inventory_count);
			}
		}, "steamcommunity");
	}

	// A bit of optimization; objects are hash tables so it's more efficient to look up by key than to iterate an array
	var quickDescriptionLookup = {};

	function getDescription(descriptions, classID, instanceID) {
		var key = classID + '_' + (instanceID || '0'); // instanceID can be undefined, in which case it's 0.

		if (quickDescriptionLookup[key]) {
			return quickDescriptionLookup[key];
		}

		for (var i = 0; i < descriptions.length; i++) {
			quickDescriptionLookup[descriptions[i].classid + '_' + (descriptions[i].instanceid || '0')] = descriptions[i];
		}

		return quickDescriptionLookup[key];
	}
};

/**
 * Get the contents of a user's inventory context.
 * @param {string} apiKey - The rapid service apikey
 * @param {SteamID|string} userID - The user's SteamID as a SteamID object or a string which can parse into one
 * @param {int} appID - The Steam application ID of the game for which you want an inventory
 * @param {int} contextID - The ID of the "context" within the game you want to retrieve
 * @param {boolean} tradableOnly - true to get only tradable items and currencies
 * @param {string} [language] - The language of item descriptions to return. Omit for default (which may either be English or your account's chosen language)
 * @param {function} callback
 */
SteamCommunity.prototype.getUserInventoryRapid = function(apiKey, userID, appID, contextID, tradableOnly, language, callback) {
	if (typeof language === 'function') {
		callback = language;
		language = "english";
	}

	if (!userID) {
		callback(new Error("The user's SteamID is invalid or missing."));
		return;
	}

	if (!apiKey) {
		callback(new Error("The apiKey is missing."));
		return;
	}

	var self = this;

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	var pos = 1;
	get([], []);

	function get(inventory, currency, start, retries = 10) {
		self.httpRequest({
			"uri": `https://steamdata1.p.rapidapi.com/inventory/${userID.getSteamID64()}/${appID}/${contextID}`,
			"qs": {
				"l": language,
				"count": 5000,
				"start_assetid": start
			},
			"headers": {
				"X-RapidAPI-Key": apiKey,
				"X-RapidAPI-Host": "steamdata1.p.rapidapi.com"
			},
			"json": true
		}, function(err, response, body) {
			if (err) {
				if (
					(err.message == "HTTP error 429" && body == null) ||
					(body && body.info && body.info.includes("took too long to respond")) ||
					(body && body.error == "Could not retrieve user inventory. Please try again later.")
				) {
					if (retries > 0) {
						get(inventory, currency, start, retries - 1);
						return;
					}
				}

				if(body && body.message == "Forbidden") {
					callback(new Error("Forbidden"));
					return;
				}

				if (err.message == "HTTP error 403" && body === null) {
					callback(new Error("This profile is private."));
					return;
				}

				if(body && body.error) {
					callback(new Error(body.error || body))
					return;
				}

				callback(err);
				return;
			}

			if (body && body.success && body.total_inventory_count === 0) {
				callback(null, [], [], 0);
				return;
			}

			if (!body || !body.success || !body.assets || !body.descriptions) {
				if (body) {
					callback(new Error(body.error || body.Error || "Malformed response"));
				} else {
					callback(new Error("Malformed response"));
				}

				return;
			}

			for (var i = 0; i < body.assets.length; i++) {
				var description = getDescription(body.descriptions, body.assets[i].classid, body.assets[i].instanceid);

				if (!tradableOnly || (description && description.tradable)) {
					body.assets[i].pos = pos++;
					(body.assets[i].currencyid ? currency : inventory).push(new CEconItem(body.assets[i], description, contextID));
				}
			}

			if (body.more_items) {
				get(inventory, currency, body.last_assetid);
			} else {
				callback(null, inventory, currency, body.total_inventory_count);
			}
		}, "steamcommunity");
	}

	// A bit of optimization; objects are hash tables so it's more efficient to look up by key than to iterate an array
	var quickDescriptionLookup = {};

	function getDescription(descriptions, classID, instanceID) {
		var key = classID + '_' + (instanceID || '0'); // instanceID can be undefined, in which case it's 0.

		if (quickDescriptionLookup[key]) {
			return quickDescriptionLookup[key];
		}

		for (var i = 0; i < descriptions.length; i++) {
			quickDescriptionLookup[descriptions[i].classid + '_' + (descriptions[i].instanceid || '0')] = descriptions[i];
		}

		return quickDescriptionLookup[key];
	}
};


/**
 * Upload an image to Steam and send it to another user over Steam chat.
 * @param {SteamID|string} userID - Either a SteamID object or a string that can parse into one
 * @param {Buffer} imageContentsBuffer - The image contents, as a Buffer
 * @param {{spoiler?: boolean}} [options]
 * @param {function} callback
 */
SteamCommunity.prototype.sendImageToUser = function(userID, imageContentsBuffer, options, callback) {
	if (typeof options == 'function') {
		callback = options;
		options = {};
	}

	options = options || {};

	if (!userID) {
		callback(new Error('The user\'s SteamID is invalid or missing'));
		return;
	}

	if (typeof userID == 'string') {
		userID = new SteamID(userID);
	}

	if (!Buffer.isBuffer(imageContentsBuffer)) {
		callback(new Error('The image contents must be a Buffer containing an image'));
		return;
	}

	var imageDetails = null;
	try {
		imageDetails = imageSize(imageContentsBuffer);
	} catch (ex) {
		callback(ex);
		return;
	}

	var imageHash = Crypto.createHash('sha1');
	imageHash.update(imageContentsBuffer);
	imageHash = imageHash.digest('hex');

	var filename = Date.now() + '_image.' + imageDetails.type;

	this.httpRequestPost({
		uri: 'https://steamcommunity.com/chat/beginfileupload/?l=english',
		headers: {
			referer: 'https://steamcommunity.com/chat/'
		},
		formData: { // it's multipart
			sessionid: this.getSessionID(),
			l: 'english',
			file_size: imageContentsBuffer.length,
			file_name: filename,
			file_sha: imageHash,
			file_image_width: imageDetails.width,
			file_image_height: imageDetails.height,
			file_type: 'image/' + (imageDetails.type == 'jpg' ? 'jpeg' : imageDetails.type)
		},
		json: true
	}, (err, res, body) => {
		if (err) {
			if (body && body.success) {
				var err2 = Helpers.eresultError(body.success);
				if (body.message) {
					err2.message = body.message;
				}
				callback(err2);
			} else {
				callback(err);
			}
			return;
		}

		if (body.success != 1) {
			callback(Helpers.eresultError(body.success));
			return;
		}

		var hmac = body.hmac;
		var timestamp = body.timestamp;
		var startResult = body.result;

		if (!startResult || !startResult.ugcid || !startResult.url_host || !startResult.request_headers) {
			callback(new Error('Malformed response'));
			return;
		}

		// Okay, now we need to PUT the file to the provided URL
		var uploadUrl = (startResult.use_https ? 'https' : 'http') + '://' + startResult.url_host + startResult.url_path;
		var headers = {};
		startResult.request_headers.forEach((header) => {
			headers[header.name.toLowerCase()] = header.value;
		});

		this.httpRequest({
			uri: uploadUrl,
			method: 'PUT',
			headers,
			body: imageContentsBuffer
		}, (err, res, body) => {
			if (err) {
				callback(err);
				return;
			}

			// Now we need to commit the upload
			this.httpRequestPost({
				uri: 'https://steamcommunity.com/chat/commitfileupload/',
				headers: {
					referer: 'https://steamcommunity.com/chat/'
				},
				formData: { // it's multipart again
					sessionid: this.getSessionID(),
					l: 'english',
					file_name: filename,
					file_sha: imageHash,
					success: '1',
					ugcid: startResult.ugcid,
					file_type: 'image/' + (imageDetails.type == 'jpg' ? 'jpeg' : imageDetails.type),
					file_image_width: imageDetails.width,
					file_image_height: imageDetails.height,
					timestamp,
					hmac,
					friend_steamid: userID.getSteamID64(),
					spoiler: options.spoiler ? '1' : '0'
				},
				json: true
			}, (err, res, body) => {
				if (err) {
					callback(err);
					return;
				}

				if (body.success != 1) {
					callback(Helpers.eresultError(body.success));
					return;
				}

				if (body.result.success != 1) {
					// lol valve
					callback(Helpers.eresultError(body.result.success));
					return;
				}

				if (!body.result.details || !body.result.details.url) {
					callback(new Error('Malformed response'));
					return;
				}

				callback(null, body.result.details.url);
			}, 'steamcommunity');
		}, 'steamcommunity');
	}, 'steamcommunity');
};

SteamCommunity.prototype.getCommentPrivacy = function(userID, callback) {
	if (typeof userID === 'undefined') {
		throw new Error('ID64 is undefined');
	}

	if (typeof userID === 'string') {
		userID = new SteamID(userID);
	}

	this.httpRequest({
		uri: "https://steamcommunity.com/profiles/" + userID.toString(),
	},
	(err, _response, body) => {
		if (err) {
			callback(err);
		}

		const $ = Cheerio.load(body);
		const profileCommentArea = $('.profile_comment_area')

		if(!profileCommentArea) {
			callback(new Error("Malformed response"));
		}

		const commentPrivacy = profileCommentArea.children().length > 0 ? 'Public' : 'Private';

		callback(null, commentPrivacy);
	}, "steamcommunity");
}
