const HttpStatus = require('http-status-codes');
const dateFormat = require('dateformat');
const messages = require('./db/messages');

const DEFAULT_EXPIRATION_TIMEOUT = 60;

const DATE_FORMAT = 'yyyy-mm-dd HH:MM:ss';

let redisClient = null;
let dbMessagesClient = null;

function create(req, res) {
	const username = req.body.username;
	const text = req.body.text;
	const timeout = req.body.timeout;

	if (!username) {
		res.status(HttpStatus.BAD_REQUEST).json({error: 'username field is required'});
		return;
	}

	if (!text) {
		res.status(HttpStatus.BAD_REQUEST).json({error: 'text field is required'});
		return;
	}

	if (typeof timeout != 'number') {
		res.status(HttpStatus.BAD_REQUEST).json({error: 'timeout must be a number'});
		return;
	}

	if (timeout < 0) {
		res.status(HttpStatus.BAD_REQUEST).json({error: 'timeout must be > 0'});
		return;
	}

	dbMessagesClient.insert({
		username: username,
		text: text,
		exp: getExpirationTimestamp(timeout),
	}).then((msg) => {
		res.status(HttpStatus.CREATED).json({id: msg.id});
	})
	.catch(() => {
		res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({error: 'error happened while inserting a message'});
	});
};

function get(req, res) {
	const id = req.params.id;

	if (redisClient.hgetall(messageKey(id), (err, obj) => {
		if (err) {
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({error: 'error happened while getting a message'});
			return;
		}

		if (!obj) {
			dbMessagesClient.get(id)
				.then((msg) => {
					obj = {
						username: msg.username,
						text: msg.text,
						expiration_date: dateFormat(msg.expiration_date, DATE_FORMAT),
					};
					redisClient.hmset(messageKey(id), obj);
					res.json(obj);
				})
				.catch((e) => {
					if (e.message === 'not found') {
						res.status(HttpStatus.NOT_FOUND).json({error: 'not found'});
					} else {
						res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({error: 'error happened while getting a message'});
					}
				});
		} else {
			res.json(obj);
		}
	}));
}

function list(req, res) {
	const username = req.params.username;

	if (!username) {
		res.status(HttpStatus.BAD_REQUEST).json({error: 'username field is required'});
		return;
	}

	dbMessagesClient.list(username)
		.then((msgs) => {
			if (!msgs.length) {
				res.json([]);
				return;
			}
			const now = new Date();
			const nonExpired = msgs.filter((msg) => msg.expiration_date > now);
			nonExpired.forEach((msg) => {
				msg.expiration_date = now;
				redisClient.del(messageKey(msg.id));
			});
			dbMessagesClient.moveToExpired(username, msgs)
				.then(() => {
					res.json(nonExpired.map((msg) => ({
						id: msg.id,
						text: msg.text,
					})));
				})
				.catch(() => {
					res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({error: 'error happened while getting messages'});
				});
		})
		.catch(() => {
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({error: 'error happened while getting messages'});
		});
	;
};

function messageKey(id) {
	return 'messages' + id;
}

function getExpirationTimestamp(timeout) {
	if (timeout == undefined) {
		timeout = DEFAULT_EXPIRATION_TIMEOUT;
	}
	const now = new Date();
	return new Date(now.getTime() + timeout * 1000);
}

module.exports = function(cassandra, redis) {
	dbMessagesClient = messages(cassandra);
	redisClient = redis;
	return {
		create: create,
		get: get,
		list: list,
	};
}