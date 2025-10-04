const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let waitingUsers = {}; 
let activePairs = {};

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('start_chat', (interestsString) => {
        const interests = normalizeInterests(interestsString);
        console.log(`${socket.id} is looking for a chat with interests: ${interests}`);
        
        delete waitingUsers[socket.id]; 

        waitingUsers[socket.id] = {
            interests: interests,
            socket: socket
        };

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
        delete waitingUsers[socket.id];
        handleDisconnection(socket.id);
    });
});

function normalizeInterests(interestsString) {
    if (!interestsString || interestsString.trim() === '') {
        return 'General';
    }
    return interestsString.toLowerCase().split(',').map(i => i.trim()).filter(i => i !== '').join(',');
}

function matchUsers() {
    const userIds = Object.keys(waitingUsers);
    if (userIds.length < 2) {
        return; 
    }

    for (let i = 0; i < userIds.length; i++) {
        const user1Id = userIds[i];
        const user1 = waitingUsers[user1Id];
        
        for (let j = i + 1; j < userIds.length; j++) {
            const user2Id = userIds[j];
            const user2 = waitingUsers[user2Id];

            if (user1Id === user2Id) continue;

            const user1Interests = user1.interests.split(',');
            const user2Interests = user2.interests.split(',');
            
            const commonInterest = user1Interests.some(interest => 
                user2Interests.includes(interest) || interest === 'general' || user2.interests === 'general'
            );

            if (commonInterest) {
                delete waitingUsers[user1Id];
                delete waitingUsers[user2Id];

                activePairs[user1Id] = user2Id;
                activePairs[user2Id] = user1Id;

                console.log(`Matched: ${user1Id} and ${user2Id} (Common interests found)`);

                io.to(user1Id).emit('match_found');
                io.to(user2Id).emit('match_found');
                
                return; 
            }
        }
    }
}

function handleDisconnection(userId) {
    const partnerId = activePairs[userId];
    
    if (partnerId) {
        io.to(partnerId).emit('partner_disconnected');
        
        delete activePairs[userId];
        delete activePairs[partnerId];

        const partnerData = waitingUsers[partnerId] ? waitingUsers[partnerId] : null;
        
        if (partnerData) {
             console.log(`Partner ${partnerId} is now looking for a new match.`);
             matchUsers(); 
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`OHmegle Server running on http://localhost:${PORT}`);
});