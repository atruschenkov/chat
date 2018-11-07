const cassandra = require('cassandra-driver');
const commandLineArgs = require('command-line-args')
const cors = require('cors');
const express = require('express');
const messages = require('./messages');
const redis = require("redis");

const optionDefinitions = [
  { name: 'port', alias: 'p', type: Number, defaultValue: 3000 },
  { name: 'database', alias: 'd', type: String, defaultValue: 'localhost' },
  { name: 'cache', alias: 'c', type: String, defaultValue: 'localhost' }
];

const options = commandLineArgs(optionDefinitions);

const redisClient = redis.createClient({host: options.cache});
const cassandraClient = new cassandra.Client({contactPoints: [options.database], keyspace: 'chat'});

const msgs = messages(cassandraClient, redisClient);

const app = express();

app.use(cors());
app.use(express.json());

app.post('/chat', msgs.create);
app.get('/chat/:id', msgs.get);
app.get('/chats/:username', msgs.list);

app.listen(options.port, () => {
	console.log(`Server is listening on port ${options.port}!`);
});