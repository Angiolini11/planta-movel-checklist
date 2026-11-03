export const MODULES = [
  { code:'QJ341', title:'Britador de mandíbulas', short:'Britador primário', image:'equipment/qj341.jpg' },
  { code:'QH441', title:'Britador cônico', short:'Britador secundário', image:'equipment/qh441.jpg' },
  { code:'QA452', title:'Peneira móvel', short:'Classificação e peneiramento', image:'equipment/qa452.jpg' },
] as const;
export type ModuleCode = typeof MODULES[number]['code'];
export const QUESTIONS: Record<ModuleCode,{title:string;help:string}[]> = {
  QJ341:[
    {title:'Proteções e dispositivos de segurança',help:'Observação externa de proteções, sinalizações e dispositivos visíveis. Não acessar áreas perigosas.'},
    {title:'Vazamentos aparentes',help:'Observar externamente possíveis vazamentos em local seguro. Não tocar em linhas pressurizadas.'},
    {title:'Correias transportadoras',help:'Observar externamente condições aparentes e anormalidades. Intervenção apenas após parada e bloqueio.'},
    {title:'Alimentador',help:'Verificar visualmente alimentação e ruídos perceptíveis de posição segura; não acessar partes móveis.'},
    {title:'Câmara de britagem e mandíbulas',help:'Registrar condição observável. Inspeção interna exige parada, isolamento e procedimento autorizado.'},
    {title:'Lubrificação e sistema hidráulico',help:'Verificar indicações e sinais externos autorizados. Não abrir sistemas sob pressão.'},
    {title:'Ruídos e vibrações anormais',help:'Identificar variações perceptíveis em posição segura e registrar para avaliação.'},
    {title:'Painel e alarmes',help:'Consultar somente indicadores e alertas permitidos ao operador, conforme procedimento local.'},
  ],
  QH441:[
    {title:'Proteções e dispositivos de segurança',help:'Inspecionar visualmente proteções e sinalizações sem remover barreiras.'},
    {title:'Vazamentos aparentes',help:'Buscar indícios externos em área segura; não aproximar mãos de partes pressurizadas.'},
    {title:'Correias transportadoras',help:'Avaliar externamente movimentação e condições visíveis; intervenção requer parada e bloqueio.'},
    {title:'Alimentação do britador',help:'Observar o fluxo de alimentação somente do ponto permitido.'},
    {title:'Condição do britador cônico',help:'Registrar anormalidades visíveis ou audíveis. Verificações internas exigem procedimento seguro.'},
    {title:'Lubrificação e sistema hidráulico',help:'Conferir indicações autorizadas e sinais de vazamento sem intervir.'},
    {title:'Ruídos e vibrações anormais',help:'Observar alterações perceptíveis sem acessar a zona de risco.'},
    {title:'Painel e alarmes',help:'Verificar mensagens e alertas visíveis no painel conforme orientação interna.'},
  ],
  QA452:[
    {title:'Proteções e dispositivos de segurança',help:'Observar proteções e sinalizações acessíveis, sem retirar dispositivos.'},
    {title:'Vazamentos aparentes',help:'Buscar sinais externos de vazamentos mantendo distância segura.'},
    {title:'Correias transportadoras',help:'Observar condições aparentes. Aproximação ou ajuste só com parada e bloqueio.'},
    {title:'Telas e grampos de fixação',help:'Registrar sinais externos; inspeção física exige equipamento parado e bloqueado.'},
    {title:'Decks de peneiramento',help:'Observar indicações de funcionamento. Acesso aos decks exige liberação e bloqueio.'},
    {title:'Mancais e lubrificação',help:'Verificar sinais externos permitidos e informações autorizadas, sem contato com partes móveis.'},
    {title:'Ruídos e vibrações anormais',help:'Observar alterações de forma segura e informar anormalidades.'},
    {title:'Painel e alarmes',help:'Consultar indicadores e alarmes disponíveis, sem alterar parâmetros não autorizados.'},
  ],
};
export const CONDITIONS=[
 {value:'em_operacao',label:'Em operação / será utilizado'},
 {value:'nao_utilizado',label:'Não utilizado no turno'},
 {value:'em_manutencao',label:'Em manutenção'},
 {value:'indisponivel',label:'Indisponível por anomalia'},
] as const;
export const ANSWERS=[
 {value:'conforme',label:'Conforme'},
 {value:'anomalia',label:'Anomalia'},
 {value:'nao_aplica',label:'Não se aplica'},
 {value:'nao_verificado',label:'Não verificado'},
] as const;
export const STOP_REASONS=['Manutenção preventiva','Manutenção corretiva','Falta de alimentação','Limpeza','Movimentação ou posicionamento','Parada operacional','Outros'];
export const OCCURRENCE_CATEGORIES=['Movimentação da planta','Posicionamento','Limpeza','Regulagem','Manutenção','Outros'];
export const MATERIALS=['Hematita Bocaina','Hematitinha','Granulado','Outro'];
