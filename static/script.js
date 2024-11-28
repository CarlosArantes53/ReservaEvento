const socket = io();

fetch('/api/eventos')
    .then(response => response.json())
    .then(events => {
        console.log("results", events)
        atualizarEventos(events);
    });

socket.on('atualizar_eventos', (events) => {
    atualizarEventos(events);
});


function atualizarUsuariosOnline(userList) {
    const lista = document.getElementById('queue-list');
    lista.innerHTML = '';

    userList.forEach(userId => {
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.textContent = `Session_${userId}`;
        lista.appendChild(li);
    });
}

socket.on('atualizar_usuarios_online', function (usuariosOnline) {
    atualizarUsuariosOnline(usuariosOnline);
});

socket.on('user_id', function (data) {
    const userId = data.user_id;
    console.log('ID do usuário logado:', userId);
});

socket.on('interacao_liberada', function (data) {
    const userId = data.user_id;
    if (userId === userId) {
        alert("Sua interação foi liberada! Você pode interagir com os eventos agora.");
    }
});

socket.on('tempo_excedido', function (data) {
    const userId = data.user_id;
    if (userId === userId) {
        alert("Seu tempo para escolha expirou. Você foi movido para o final da fila.");
    }
});

let reservaTemporaria = null;
let tempoRestante = 600;
let timerInterval = null;

function atualizarEventos(events) {
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = ''; 
    for (const [evento, info] of Object.entries(events)) {
        const card = document.createElement('div');
        card.className = 'card mb-3';
        card.style.maxWidth = '540px';

        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${evento}</h5> <!-- Classe 'card-title' para o título -->
                <p class="card-text">Vagas disponíveis: ${info.vagas}</p> <!-- Classe 'card-text' para o texto -->
                <button class="btn btn-primary reservarBtn">Reservar</button>
                <!-- Classe 'btn btn-primary' para o botão -->
            </div>
        `;

        eventList.appendChild(card);

        const reservarBtn = card.querySelector('.reservarBtn');
        reservarBtn.addEventListener('click', function () {
            reservarTemporario(evento);
        });
    }
}

function reservarTemporario(evento) {
    if (reservaTemporaria) {
        alert("Você já tem uma reserva temporária em andamento.");
        return;
    }

    reservaTemporaria = {evento};
    tempoRestante = 120;
    atualizarTimer();

    const modal = document.getElementById('modal');
    modal.style.display = 'flex';

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(atualizarTimer, 2000);

    function atualizarTimer() {
        const minutos = Math.floor(tempoRestante / 60);
        const segundos = tempoRestante % 60;
        document.getElementById('timer').innerText = `Tempo restante: ${minutos}:${segundos < 2 ? '0' : ''}${segundos}`;

        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            reservaTemporaria = null;
            socket.emit('liberar_vaga', {evento});
            modal.style.display = 'none';
            alert("O tempo para confirmação expirou. A vaga foi liberada.");
        } else {
            tempoRestante--;
        }
    }

    document.getElementById('reservaForm').onsubmit = function (event) {
        event.preventDefault();

        const userName = document.getElementById('userName').value;
        const userPhone = document.getElementById('userPhone').value;

        if (userName && userPhone) {
            socket.emit('confirmar_reserva', {userName, userPhone, evento});
            reservaTemporaria = null;
            clearInterval(timerInterval);
            modal.style.display = 'none';
            alert("Reserva confirmada com sucesso!");
        } else {
            alert("Por favor, preencha seu nome e telefone.");
        }
    };

    document.getElementById('cancelarBtn').onclick = function () {
        clearInterval(timerInterval);
        reservaTemporaria = null;
        socket.emit('liberar_vaga', {evento});
        modal.style.display = 'none';
        alert("Reserva cancelada.");
    };
}

function adicionarNaFila(userId, tempoEspera) {
    const lista = document.getElementById('queue-list');

    const li = document.createElement('li');
    li.classList.add('list-group-item', 'd-flex', 'justify-content-between');

    li.innerHTML =
        `<span>Session_${userId}</span>
    <span class="badge bg-warning">${tempoEspera}s</span>
    `;

    lista.appendChild(li);
}

socket.on('user_id', function (data) {
    const userId = data.user_id;
    console.log('ID do usuário logado:', userId);

    adicionarNaFila(userId, 19);
});

socket.on('atualizar_eventos', (events) => {
    atualizarEventos(events);
});

// Atualiza a lista de usuários conectados
// socket.on('atualizar_usuarios_online', (userCount) => {
//     document.getElementById('user-count').innerText = userCount;
// });

socket.on('atualizar_usuarios_online', function (userCount) {
    const count = userCount.length
    document.getElementById('user-count').innerText = count;
    document.getElementById('loading').style.display = 'none';
});

setInterval(() => {
    document.getElementById('loading').style.display = 'block';
}, 1000);

function reservar(evento) {
    const userId = prompt("Digite seu ID de usuário:");
    if (userId) {
        socket.emit('reservar', {user_id: userId, evento});
    }
}

function monitorarTempoFila() {
    const filaTimer = setInterval(() => {
        if (reservaTemporaria) {
            clearInterval(filaTimer);
            return;
        }

        tempoFila -= 1;
        if (tempoFila <= 0) {
            socket.emit('tempo_fila', { user_id: meuUserId });
            clearInterval(filaTimer);
        }
    }, 1000);
}

socket.on('atualizar_fila', function (fila) {
    atualizarUsuariosOnline(fila);
    if (fila.includes(meuUserId)) {
        monitorarTempoFila();
    }
});