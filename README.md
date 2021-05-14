### [Simple P2P server developed as a part of TalTech's course ITI0215.](http://lambda.ee/wiki/Vorgurakendused_2_prax_1_2021_kevad)
This program is a node of possibly bigger P2P network, where each node functions both as a server and a client. It maintains a list of known nodes who it tries to connect to and distribute information with. To do that, it sends and receives HTTP requests, handles them and stores received data in .txt files.

To get started, go to root folder and run the following commands:
```
npm install
```
```
npx ts-node entrypoint.ts {{port}}
```
... where {{port}} is replaced by whichever port you want the server to listen on.

Server automatically generates connection file with a name of `peers-{{port}}.txt` under `connections` folder.

This has to be filled manually, separating each peer into a separate line.
For example if there is peer running locally on port 3000, a new line has to be added `localhost:3000`.

Server also generates new transactions and distributes them to other peers, simulating a ledger.
Ledger is maintained in `blocks-{{port}}.txt` file under `blocks` folder.


## API

### GET /health 
RESPONSE: 200


### GET /get-peers?ip=:ip
RESPONSE: `["192.168.2.145:3000", "192.168.2.145:3001"]`


### POST /block?ip=:ip
REQUEST: 
```
{"index":3,"previousHash":"fc26dda85f2cde610da7a99197545cb7e706116a9bcf84a17f0fa2e7b7c7720b","transactions":[{"to":"Joosep"}],"timestamp":1617254169144}
```
RESPONSE: `200 - 'Added and distributed.' | 'Ignored.'`

### POST /new-transaction?ip=:ip
REQUEST: 
```
{ "from": "Joe", "to": "Joosep", "amount": 10 }
```
RESPONSE: `200 - 'Transaction pending.' | '400 - 'Bad Request.'`

### POST /create-block
RESPONSE: `200 - 'Added and distributed.' | 'Nothing pending.'`


### GET /get-blocks
RESPONSE: 
```
[
  {"index":0,"previousHash":null,"transactions":[{"to":"Joosep"}],"timestamp":1617254169144},
  {"index":1,"previousHash":"fb021aaf5a4c7c087aadb126a7981114f1e9a86eeffea7539e9bef9470600d96","transactions":[{"to":"Joel"}],"timestamp":1617254240128},
  {"index":2,"previousHash":"2b6e94bfdb4615ddf7629d4cc9ad80fb74da00506bc249e250ed140c62592111","transactions":[{"to":"Joonas"}],"timestamp":1617254244048}
]
```


### GET /get-block/:hash
RESPONSE: 
```
{"index":1,"previousHash":"fb021aaf5a4c7c087aadb126a7981114f1e9a86eeffea7539e9bef9470600d96","transactions":[{"to":"Joel"}],"timestamp":1617254240128},
```


### GET /get-blocks/:hash
RESPONSE: 
```
[
  {"index":1,"previousHash":"fb021aaf5a4c7c087aadb126a7981114f1e9a86eeffea7539e9bef9470600d96","transactions":[{"to":"Joel"}],"timestamp":1617254240128},
  {"index":2,"previousHash":"2b6e94bfdb4615ddf7629d4cc9ad80fb74da00506bc249e250ed140c62592111","transactions":[{"to":"Joonas"}],"timestamp":1617254244048}
]
```
