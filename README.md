### [Simple P2P server developed as a part of TalTech's course ITI0215.](http://lambda.ee/wiki/Vorgurakendused_2_prax_1_2021_kevad)
It tries to connect to other peers within it's connection file and adds unknown peers to it's own list.


To get started, go to root folder and run the following commands:
```
npm install
```
```
node app.js {{port}}
```
... where {{port}} is replaced by whichever port you want the server to listen on.

Server automatically generates connection file with a name of `peers-{{port}}.txt` under `connections` folder.

This has to be filled manually, separating each peer into a separate line and making sure that last line is empty.
For example if there is peer running locally on port 3000, a new line has to be added `localhost:3000`.
