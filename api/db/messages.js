const TimeUuid = require('cassandra-driver').types.TimeUuid;

let client = null;

function insert(msg) {
	const query = 'INSERT INTO Messages(id, username, text, expiration_date) VALUES (?, ?, ?, ?)';
	const id = TimeUuid.now();
	const params = [id, msg.username, msg.text, msg.exp];
	return new Promise((resolve, reject) => {
		client.execute(query, params, {prepare: true})
			.then(() => {
				msg.id = id;
				resolve(msg);
			}).catch((e) => {
				reject(e);
			});
	}) 
}

function get(id) {
	const query = 'SELECT username, text, expiration_date FROM Messages WHERE id = ?';
	const queryExpires = 'SELECT username, text, expiration_date FROM ExpiredMessages WHERE id = ?';
	const params = [TimeUuid.fromString(id)];

	return Promise.all([
		client.execute(query, params, {prepare: true}),
		client.execute(queryExpires, params, {prepare: true}),
	]).then((responses) => {
		let row;
		if (responses[0].rowLength) {
			row = responses[0].first();
		} else if (responses[1].rowLength) {
			row = responses[1].first();
		}

		if (!row) {
			throw new Error('not found');
		}

		return {
			username: row.username,
			text: row.text,
			expiration_date: row.expiration_date,
		};
	});
}

function list(username) {
	return new Promise((resolve, reject) => {
		const query = 'SELECT id, text, expiration_date FROM Messages WHERE username = ?';
		const params = [username];
		const messages = [];
		client.eachRow(query, params, {prepare: true, autoPage: true}, (n, row) => {
			messages.push({
				id: row.id,
				username: username,
				text: row.text,
				expiration_date: row.expiration_date,
			});
		}, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve(messages);	
			}
		});
	});
}

function moveToExpired(username, messages) {
	const batch = [];
	messages.forEach((msg) => {
		batch.push({
			query: 'INSERT INTO ExpiredMessages(id, username, text, expiration_date) VALUES (?, ?, ?, ?)',
			params: [msg.id, msg.username, msg.text, msg.expiration_date],
		});
	});

	batch.push({
	    query: 'DELETE FROM Messages WHERE username = ? AND id IN ?',
	    params: [username, messages.map((msg) => msg.id)],
	});	

	return client.batch(batch, {prepare: true});
}

module.exports = function(cassandraClient) {
	client = cassandraClient;

	return {
		insert: insert,
		get: get,
		list: list,
		moveToExpired: moveToExpired,
	};
}