const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const path = require('path');

const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

function delay(t, v) {
  return new Promise(function(resolve) { 
      setTimeout(resolve.bind(null, v), t)
  });
}

app.use(express.json());
app.use(express.urlencoded({
extended: true
}));
app.use(fileUpload({
debug: true
}));
app.use("/", express.static(__dirname + "/"))

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'ISAZAP' }),
  puppeteer: { headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ] }
});

client.initialize();

io.on('connection', function(socket) {
  socket.emit('message', '© ISAZAP - Iniciado');
  socket.emit('qr', './icon.svg');
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', url);
      io.emit('message', '© ISAZAP QRCode recebido, aponte a câmera do seu celular!');
    });
});

client.on('ready', () => {
    io.emit('ready', '© ISAZAP Dispositivo pronto!');
    io.emit('message', '© ISAZAP Dispositivo pronto!');
    io.emit('qr', './check.svg')  
    console.log('© ISAZAP Dispositivo pronto');
});

client.on('authenticated', () => {
    io.emit('authenticated', '© ISAZAP Autenticado!');
    io.emit('message', '© ISAZAP Autenticado!');
    console.log('© ISAZAP Autenticado');
});

client.on('auth_failure', function() {
    io.emit('message', '© ISAZAP Falha na autenticação, reiniciando...');
    console.error('© ISAZAP Falha na autenticação');
});

client.on('change_state', state => {
  console.log('© ISAZAP Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  io.emit('message', '© ISAZAP Cliente desconectado!');
  console.log('© ISAZAP Cliente desconectado', reason);
  client.initialize();
});

const formatNumber = (number) => {
    const numberDDI = number.substr(0, 2);
    const numberDDD = number.substr(2, 2);
    const numberUser = number.substr(-8, 8);

    if (numberDDI === "55") {
        if (parseInt(numberDDD) <= 30) {
            return `55${numberDDD}9${numberUser}@c.us`;
        } else {
            return `55${numberDDD}${numberUser}@c.us`;
        }
    }
    return `${number}@c.us`;
};

// Send message
app.post('/zdg-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => msg);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const message = req.body.message;
  const numberZDG = formatNumber(number);

  client.sendMessage(numberZDG, message).then(response => {
    res.status(200).json({
      status: true,
      message: 'ISAZAP Mensagem enviada',
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      message: 'ISAZAP Mensagem não enviada',
      response: err.text
    });
  });
});


// Send media
app.post('/zdg-media', [
  body('number').notEmpty(),
  body('caption').notEmpty(),
  body('file').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({ msg }) => msg);

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = req.body.number;
  const caption = req.body.caption;
  const fileUrl = req.body.file;
  const numberZDG = formatNumber(number);

  let mimetype;
  try {
    const attachment = await axios.get(fileUrl, {
      responseType: 'arraybuffer'
    }).then(response => {
      mimetype = response.headers['content-type'];
      return response.data.toString('base64');
    });

    const media = new MessageMedia(mimetype, attachment, 'Media');

    client.sendMessage(numberZDG, media, { caption: caption }).then(response => {
      res.status(200).json({
        status: true,
        message: 'ISAZAP Imagem enviada',
        response: response
      });
    }).catch(err => {
      res.status(500).json({
        status: false,
        message: 'ISAZAP Imagem não enviada',
        response: err.text
      });
    });
  } catch (error) {
    res.status(500).json({
        status: false,
        message: 'Falha ao buscar o arquivo de mídia da URL.',
        response: error.toString()
    });
  }
});

// Lógica do Chatbot (Apenas em Português)
client.on('message', async msg => {
  const nomeContato = msg._data.notifyName;
  let groupChat = await msg.getChat();
  
  if (groupChat.isGroup) return null;
  if (msg.type.toLowerCase() == "e2e_notification") return null;
  if (msg.body == "") return null;
  if (msg.from.includes("@g.us")) return null;

  if (msg.body !== null && msg.body === "1") {
    msg.reply("Na *Isazap* você vai integrar APIs, automações com chatbots e sistemas de atendimento multiusuário para whatsapp. Com *scripts para copiar e colar e suporte todos os dias no grupo de alunos*.\n\nhttps://comunidadezdg.com.br/ \n\n*⏱️ As inscrições estão ABERTAS*\n\nAssista o vídeo abaixo e entenda porque tanta gente comum está economizando tempo e ganhando dinheiro explorando a API do WPP, mesmo sem saber nada de programação.\n\n📺 https://www.youtube.com/watch?v=AoRhC_X6p5w")
  } 
  
  else if (msg.body !== null && msg.body === "2") {
    msg.reply("*" + nomeContato + "*, na Isazap, você vai:\n\n- Utilizar códigos já testados para automatizar seu atendimento com chatbots no whatsapp\n- Criar e aplicativos para gestão de CRM e plataformas multiusuários para chats de atendimento\n- Aprender integrações com ferramentas e APIs que já foram testadas e aprovadas pela comunidade\n- Curadoria de plugins e ferramentas gratuitas para impulsionar o marketing de conversa no seu negócio\n- Se conectar a mais de 2.000 alunos que também estão estudando e implementando soluções de marketing de conversa\n- Grupo de alunos organizado por tópicos\n- Ter acesso ao meu suporte pessoal todos os dias");
  }
  
  else if (msg.body !== null && msg.body === "3") {
    msg.reply("*" + nomeContato + "*, " + "essas são as principais APIs que a ZDG vai te ensinar a usar com o WhatsApp:\nBaileys, Venom-BOT, WPPConnect, WPPWeb-JS e Cloud API (Api Oficial)\n\n*Essas são as principais integrações que a ZDG vai te ensinar a fazer com o WhatsApp:*\nBubble, WordPress (WooCommerce e Elementor), Botpress, N8N, DialogFlow, ChatWoot e plataformas como Hotmart, Edduz, Monetizze, Rd Station, Mautic, Google Sheets, Active Campaing, entre outras.");
  }
  
  else if (msg.body !== null && msg.body === "4") {
    const contact = await msg.getContact();
    setTimeout(function() {
        msg.reply(`@${contact.number}` + ' seu contato já foi encaminhado para o Isaac');  
        client.sendMessage('5541985270469@c.us','Contato Isazap. https://wa.me/' + `${contact.number}`);
    },1000 + Math.floor(Math.random() * 1000));
  }
  
  else if (msg.body !== null && msg.body === "5") {
    msg.reply("*" + nomeContato + "*, " + "aproveite o conteúdo e aprenda em poucos minutos como colocar sua API de WPP no ar, gratuitamente:\r\n\r\n🎥 https://youtu.be/sF9uJqVfWpg");
  }

  else if (msg.body !== null && msg.body === "6"){
    const indice = MessageMedia.fromFilePath(path.join(__dirname, 'indice.pdf'));
    client.sendMessage(msg.from, indice, {caption: 'Isazap 2.0'});
    delay(4500).then(async function() {
      msg.reply("📘 INFORMAÇÃO SOBRE O ISAZAP\r\n\r\nPara saber mais sobre o **Isazap**, ferramenta de envio de mensagens em massa pelo WhatsApp, será enviado um **PDF** com todas as informações e instruções sobre este serviço.\r\n\r\n🚀 O material inclui detalhes sobre instalação, utilização e boas práticas para aproveitar o máximo da ferramenta.");
    });
  }
  
  else if (msg.body !== null && msg.body === "7") {
    msg.reply("*" + nomeContato + "*, " + ", que ótimo, vou te enviar alguns cases de sucesso:\n\n📺 https://youtu.be/KHGchIAZ5i0\nGustavo: A estratégia mais barata, eficiente e totalmente escalável.\n\n📺 https://youtu.be/S4Cwrnn_Llk\nNatália: Nós aumentamos o nosso faturamento e vendemos pra mais clientes com a estratégia ZDG.\n\n📺 https://youtu.be/XP2ns7TOdIQ\nYuri: A ferramenta me ajudou muito com as automações da minha loja online.\n\n📺 https://youtu.be/KBedG3TcBRw\nFrancisco: O Pedrinho pega na nossa mão. Se eu consegui, você também consegue.\n\n📺 https://youtu.be/L7dEoEwqv-0\nBruno: A Isazap e o suporte do Pedrinho são incríveis. Depois que eu adquiri o curso eu deixei de gastar R$300,00 todo mês com outras automações.\n\n📺 https://youtu.be/StRiSLS5ckg\nRodrigo: Eu sou desenvolvedor de sistemas, e venho utilizando as soluções do Pedrinho para integrar nos meus sistemas, e o ganho de tempo é excepcional.");
  }
    
  // --- BLOCOS DE CÓDIGO DE INGLÊS E ESPANHOL REMOVIDOS ---

  // Resposta Padrão
  else if (msg.body !== null || msg.body === "0" || msg.type === 'ptt' || msg.hasMedia) {
    msg.reply("*ISAZAP*\n\n🤪 _Usar o WPP de maneira manual é prejudicial a saúde_\r\n\r\nhttps://site.isazap.com.br/ \r\n\r\n⏱️ ");
    const foto = MessageMedia.fromFilePath(path.join(__dirname, 'isazap.png'));
    client.sendMessage(msg.from, foto);

    delay(3000).then(async function() {
      try{
        const media = MessageMedia.fromFilePath(path.join(__dirname, 'isazap_descricao.ogg'));
        client.sendMessage(msg.from, media, {sendAudioAsVoice: true});
      } catch(e){
        console.log('audio off: ' + e.message);
      }
    });

    delay(8000).then(async function() {
      const saudacaoes = ['Olá ' + nomeContato + ', tudo bem?', 'Oi ' + nomeContato + ', como vai você?', 'Opa ' + nomeContato + ', tudo certo?'];
      const saudacao = saudacaoes[Math.floor(Math.random() * saudacaoes.length)];
      // ATUALIZADO: Menu principal sem as opções de idioma
      msg.reply(saudacao + " Esse é um atendimento automático, e não é monitorado por um humano. Caso queira falar com um atendente, escolha a opção 4. \r\n\r\nEscolha uma das opções abaixo para iniciarmos a nossa conversa: \r\n\r\n*[ 1 ]* - Quero garantir minha vaga na Isazap. \r\n*[ 2 ]* - O que vou receber entrando para a turma da ZDG? \r\n*[ 3 ]*- Quais tecnologias e ferramentas eu vou aprender na Isazap? \r\n*[ 4 ]- Gostaria de falar com o Pedrinho, mas obrigado por tentar me ajudar.* \r\n*[ 5 ]*- Quero aprender como montar minha API de GRAÇA.\r\n*[ 6 ]*- Quero conhecer todo o conteúdo programático da Isazap.\r\n*[ 7 ]*- Gostaria de conhecer alguns estudos de caso.");
    });
  }
});

console.log("\nA Isazap é a oportunidade perfeita para você aprender a criar soluções incríveis...");
console.log("\nInscreva-se agora acessando o link: comunidadezdg.com.br\n");
    
server.listen(port, function() {
  console.log('Aplicação rodando na porta *: ' + port + ' . Acesse no link: http://localhost:' + port);
});