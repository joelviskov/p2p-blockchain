### [Simple P2P server developed as a part of TalTech's course ITI0215.](http://lambda.ee/wiki/Vorgurakendused_2_prax_1_2021_kevad)
Program consists of P2P nodes, each functioning as both a server and a client. It maintains a list of known nodes who it tries to connect to and distribute information with.
To do that, it sends and receives HTTP requests, handles them and stores received data in .txt files.

To get started, go to root folder and run the following commands:
```
npm install
```
```
node app.js {{port}}
```
... where {{port}} is replaced by whichever port you want the server to listen on.

Server automatically generates connection file with a name of `peers-{{port}}.txt` under `connections` folder.

This has to be filled manually, separating each peer into a separate line.
For example if there is peer running locally on port 3000, a new line has to be added `localhost:3000`.

Server also generates new transactions and distributes them to other peers, simulating a ledger.
Ledger is maintained in `blocks-{{port}}.txt` file under `blocks` folder.
