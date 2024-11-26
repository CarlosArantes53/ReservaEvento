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
    lista.innerHTML = ''; // Limpa a lista

    userList.forEach(userId => {
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.textContent = `Session_${userId}`;
        lista.appendChild(li);
    });
}

// Recebe a lista de usuários online e atualiza a lista no frontend
socket.on('atualizar_usuarios_online', function (usuariosOnline) {
    atualizarUsuariosOnline(usuariosOnline);
});

// Captura o ID do usuário logado via Socket.IO
socket.on('user_id', function (data) {
    const userId = data.user_id;
    console.log('ID do usuário logado:', userId);
});


let reservaTemporaria = null;
let tempoRestante = 600; // 10 minutos em segundos
let timerInterval = null;


function atualizarEventos(events) {
    const eventList = document.getElementById('event-list');
    eventList.innerHTML = ''; // Limpa a lista de eventos

    for (const [evento, info] of Object.entries(events)) {
        // Cria um card com as classes do Bootstrap
        const card = document.createElement('div');
        card.className = 'card mb-3'; // Adiciona a classe Bootstrap 'card' e 'mb-3' para margem inferior
        card.style.maxWidth = '540px'; // Estilo extra para limitar a largura

        card.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${evento}</h5> <!-- Classe 'card-title' para o título -->
                <p class="card-text">Vagas disponíveis: ${info.vagas}</p> <!-- Classe 'card-text' para o texto -->
                <button class="btn btn-primary reservarBtn">Reservar</button>
                <!-- Classe 'btn btn-primary' para o botão -->
            </div>
        `;

        eventList.appendChild(card);

        // Adiciona o ouvinte de evento para o botão de reserva
        const reservarBtn = card.querySelector('.reservarBtn');
        reservarBtn.addEventListener('click', function () {
            reservarTemporario(evento);
        });
    }
}


function reservarTemporario(evento) {
    // Verifica se já existe uma reserva temporária ativa
    if (reservaTemporaria) {
        alert("Você já tem uma reserva temporária em andamento.");
        return;
    }

    reservaTemporaria = {evento};
    // Inicia o timer de 10 minutos
    tempoRestante = 120;
    atualizarTimer();

    const modal = document.getElementById('modal');
    modal.style.display = 'flex';

    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(atualizarTimer, 2000);

    // Função que atualiza o contador de tempo
    function atualizarTimer() {
        const minutos = Math.floor(tempoRestante / 60);
        const segundos = tempoRestante % 60;
        document.getElementById('timer').innerText = `Tempo restante: ${minutos}:${segundos < 2 ? '0' : ''}${segundos}`;

        // Se o tempo expirar, libera a vaga
        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            reservaTemporaria = null; // Libera a vaga
            socket.emit('liberar_vaga', {evento});
            modal.style.display = 'none'; // Fecha o modal
            alert("O tempo para confirmação expirou. A vaga foi liberada.");
        } else {
            tempoRestante--;
        }
    }

    // Função de confirmação
    document.getElementById('reservaForm').onsubmit = function (event) {
        event.preventDefault();

        const userName = document.getElementById('userName').value;
        const userPhone = document.getElementById('userPhone').value;

        if (userName && userPhone) {
            // Envia a reserva confirmada
            socket.emit('confirmar_reserva', {userName, userPhone, evento});
            reservaTemporaria = null; // Desativa a reserva temporária
            clearInterval(timerInterval); // Para o timer
            modal.style.display = 'none'; // Fecha o modal
            alert("Reserva confirmada com sucesso!");
        } else {
            alert("Por favor, preencha seu nome e telefone.");
        }
    };

    // Função para cancelar a reserva temporária
    document.getElementById('cancelarBtn').onclick = function () {
        clearInterval(timerInterval); // Para o timer
        reservaTemporaria = null; // Libera a vaga
        socket.emit('liberar_vaga', {evento});
        modal.style.display = 'none'; // Fecha o modal
        alert("Reserva cancelada.");
    };
}

// Função para adicionar um item na lista de espera
function adicionarNaFila(userId, tempoEspera) {
    const lista = document.getElementById('queue-list');

    // Cria um novo item para a lista de espera
    const li = document.createElement('li');
    li.classList.add('list-group-item', 'd-flex', 'justify-content-between');

    // Adiciona o ID do usuário e o tempo de espera
    li.innerHTML =
        `<span>Session_${userId}</span>
    <span class="badge bg-warning">${tempoEspera}s</span>
    `;

    // Adiciona o item na lista
    lista.appendChild(li);
}

// Captura o ID do usuário logado via Socket.IO
socket.on('user_id', function (data) {
    const userId = data.user_id;
    console.log('ID do usuário logado:', userId);

    // Exemplo de adicionar o usuário logado com tempo de espera de 19s
    adicionarNaFila(userId, 19);
});

// // Exemplo de adicionar outros usuários na fila
// adicionarNaFila('7h3k3m', 23);
// adicionarNaFila('6st8u', 30);


// Recebe a atualização dos eventos em tempo real
socket.on('atualizar_eventos', (events) => {
    atualizarEventos(events);
});

// Atualiza a lista de usuários conectados
// socket.on('atualizar_usuarios_online', (userCount) => {
//     document.getElementById('user-count').innerText = userCount;
// });


// Ouve a atualização de usuários online
socket.on('atualizar_usuarios_online', function (userCount) {
    // Atualiza o contador de usuários no frontend
    const count = userCount.length
    document.getElementById('user-count').innerText = count;
    document.getElementById('loading').style.display = 'none';  // Oculta o "loading" após a atualização
});

// Exibe o "loading" enquanto os dados são recuperados
setInterval(() => {
    document.getElementById('loading').style.display = 'block'; // Exibe o loading a cada 5 segundos
}, 1000);


function reservar(evento) {
    const userId = prompt("Digite seu ID de usuário:");
    if (userId) {
        socket.emit('reservar', {user_id: userId, evento});
    }
}