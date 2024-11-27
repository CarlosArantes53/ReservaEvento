## Funciona
* Exibe a quantidade de usuários conectados à sessão.
* Mostra o ID da sessão na lateral de forma dinâmica.
* Os eventos são carregados a partir de um arquivo JSON.
* É possível clicar em um evento e confirmar a reserva (**).
* O modal exibe um timer, informando ao usuário quanto tempo ele tem para confirmar a reserva (**).
* Permite que o usuário se cadastre em um evento.

## Não funciona
* O socket não está emitindo para todos os usuários conectados quando um evento é selecionado.
* Ao clicar em "Cancelar Reserva", a quantidade de vagas não é restaurada ao seu estado inicial, pois a reserva é feita de forma temporária.
* É necessário implementar o controle de sessões (definidas pelo administrador)
