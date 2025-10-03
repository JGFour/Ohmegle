const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let waitingUsers = []; 
let activePairs = {};

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('start_chat', (interests) => {
        console.log(`${socket.id} is looking for a chat with interests: ${interests}`);
        
        socket.data.interests = interests;
        waitingUsers.push(socket.id);

        matchUsers();
    });

    socket.on('chat_message', (msg) => {
        const partnerId = activePairs[socket.id];
        if (partnerId) {
            io.to(partnerId).emit('chat_message', msg);
            socket.emit('chat_message_self', msg); 
        }
    });

    socket.on('disconnect_chat', () => {
        handleDisconnection(socket.id);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        waitingUsers = waitingUsers.filter(id => id !== socket.id);
        handleDisconnection(socket.id);
    });
});

function matchUsers() {
    if (waitingUsers.length >= 2) {
        
        const user1Id = waitingUsers.shift(); 
        const user2Id = waitingUsers.shift(); 

        activePairs[user1Id] = user2Id;
        activePairs[user2Id] = user1Id;

        console.log(`Matched: ${user1Id} and ${user2Id}`);

        io.to(user1Id).emit('match_found');
        io.to(user2Id).emit('match_found');
    }
}

function handleDisconnection(userId) {
    const partnerId = activePairs[userId];
    
    if (partnerId) {
        io.to(partnerId).emit('partner_disconnected');
        
        delete activePairs[userId];
        delete activePairs[partnerId];

        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket) {
             console.log(`Partner ${partnerId} is now looking for a new match.`);
             waitingUsers.push(partnerId);
             matchUsers(); 
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`OHmegle Server running on http://localhost:${PORT}`);
});