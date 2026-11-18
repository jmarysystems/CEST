// CEST: consulta e manutenção da tabela do Convênio ICMS 142/18.
import { sb, criar, atualizar, excluir } from '../api.js';
import * as ui from '../ui.js';

const POR_PAGINA = 50;

const dataBR = (v) => {
  if (!v) return '—';
  const [a, m, d] = String(v).split('-');
  return `${d}/${m}/${a}`;
};

const dataISO = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  if (s.includes('-')) return s;
  const [d, m, a] = s.split('/');
  return `${a}-${m}-${d}`;
};

export async function render(raiz, ctx) {
  ctx.setTitulo('CEST');

  const podeCriar = ctx.pode('cest', 'cadastrar');
  const podeEditar = ctx.pode('cest', 'editar');
  const podeExcluir = ctx.pode('cest', 'excluir');

  let termo = '';
  let pagina = 0;
  let total = 0;
  let selecionado = null;

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo">
        <h2>CEST — Código Especificador da Substituição Tributária</h2>
        <div class="linha-acoes">
          <span class="sub" id="total"></span>
          ${podeCriar ? '<button type="button" class="botao-primario" id="novo">Cadastrar</button>' : ''}
        </div>
      </div>

      <div class="linha-acoes" style="margin-bottom:12px">
        <input type="search" id="busca" placeholder="Código ou descrição (ex.: 0100100 ou catalisadores)"
               style="max-width:420px">
        <button type="button" class="botao-primario" id="buscar">Buscar</button>
      </div>

      <div id="barra-selecao" class="linha-acoes" hidden
           style="margin-bottom:10px;padding:10px 12px;background:#eef3fb;border-radius:8px">
        <strong id="selecionado-info"></strong>
        ${podeEditar ? '<button type="button" class="botao-pequeno" id="editar">Editar</button>' : ''}
        ${podeExcluir ? '<button type="button" class="botao-pequeno botao-perigo" id="excluir">Excluir</button>' : ''}
        <button type="button" class="botao-pequeno" id="cancelar-selecao">Cancelar</button>
      </div>

      <div id="lista"><div class="carregando">Carregando…</div></div>

      <div class="linha-acoes" style="margin-top:14px;justify-content:center">
        <button type="button" id="anterior">← Anterior</button>
        <span class="sub" id="pagina"></span>
        <button type="button" id="proxima">Próxima →</button>
      </div>
    </div>`;

  const lista = raiz.querySelector('#lista');
  const campoBusca = raiz.querySelector('#busca');
  const barra = raiz.querySelector('#barra-selecao');

  function atualizarBarra() {
    barra.hidden = !selecionado;
    if (selecionado) {
      raiz.querySelector('#selecionado-info').textContent =
        `Selecionado: ${selecionado.cest} — ${selecionado.descricao}`;
    }
  }

  async function consultar() {
    lista.innerHTML = '<div class="carregando">Consultando…</div>';
    const inicio = pagina * POR_PAGINA;
    let q = sb.from('cest').select('*', { count: 'exact' });

    if (termo) {
      const limpo = termo.replace(/[%,()]/g, ' ').trim();
      q = q.or(`cest.ilike.%${limpo}%,descricao.ilike.%${limpo}%`);
    }

    const { data, count, error } = await q.order('cest').order('data_inicio')
      .range(inicio, inicio + POR_PAGINA - 1);
    if (error) {
      lista.innerHTML = `<div class="erro">${ui.esc(error.message)}</div>`;
      return;
    }

    total = count || 0;
    raiz.querySelector('#total').textContent = `${total.toLocaleString('pt-BR')} registro(s)`;
    raiz.querySelector('#pagina').textContent =
      `página ${pagina + 1} de ${Math.max(1, Math.ceil(total / POR_PAGINA))}`;
    raiz.querySelector('#anterior').disabled = pagina === 0;
    raiz.querySelector('#proxima').disabled = inicio + POR_PAGINA >= total;

    lista.innerHTML = data.length ? `
      <div class="tabela-rolagem"><table>
        <thead><tr><th></th><th>Cest</th><th>Descrição</th>
          <th>Data de início</th><th>Data de fim</th></tr></thead>
        <tbody>
          ${data.map((n, i) => `<tr data-i="${i}" class="${selecionado && selecionado.id === n.id ? 'sel' : ''}">
            <td><input type="radio" name="sel" data-sel="${i}"
              ${selecionado && selecionado.id === n.id ? 'checked' : ''}></td>
            <td class="mono">${ui.esc(n.cest)}</td>
            <td>${ui.esc(n.descricao)}</td>
            <td>${dataBR(n.data_inicio)}</td>
            <td>${dataBR(n.data_fim)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : ui.vazio('Nenhum registro encontrado.');

    for (const r of lista.querySelectorAll('[data-sel]')) {
      r.addEventListener('change', () => {
        selecionado = data[Number(r.dataset.sel)] || null;
        atualizarBarra();
        for (const tr of lista.querySelectorAll('tbody tr')) {
          tr.classList.toggle('sel', tr.dataset.i === r.dataset.sel);
        }
      });
    }

    atualizarBarra();
  }

  function formulario(registro) {
    const editando = !!registro.id;
    const { fechar, corpo } = ui.modal({
      titulo: editando ? 'Editar CEST' : 'Cadastrar CEST',
      largura: '680px',
      corpo: `
        <form id="form" class="grade grade-2">
          ${ui.campoTexto('Cest', 'cest', registro.cest, { obrigatorio: true })}
          ${ui.campoTexto('Data de início', 'data_inicio',
            registro.data_inicio ? dataBR(registro.data_inicio) : '', { placeholder: 'dd/mm/aaaa' })}
          ${ui.campoTexto('Descrição', 'descricao', registro.descricao, { obrigatorio: true })}
          ${ui.campoTexto('Data de fim', 'data_fim',
            registro.data_fim ? dataBR(registro.data_fim) : '', { placeholder: 'dd/mm/aaaa' })}
          <div class="linha-acoes campo-largo">
            <button type="submit" class="botao-primario">${editando ? 'Salvar' : 'Cadastrar'}</button>
            <button type="button" id="cancelar">Cancelar</button>
          </div>
        </form>`,
    });

    corpo.querySelector('#cancelar').addEventListener('click', fechar);
    corpo.querySelector('#form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = ui.dadosDoForm(ev.target);
      const valores = {
        cest: d.cest,
        descricao: d.descricao,
        data_inicio: dataISO(d.data_inicio),
        data_fim: dataISO(d.data_fim),
      };
      try {
        if (editando) await atualizar('cest', registro.id, valores);
        else await criar('cest', valores);
        fechar();
        ui.toast(editando ? 'CEST atualizado.' : 'CEST cadastrado.');
        selecionado = null;
        ctx.recarregar();
      } catch (erro) {
        ui.toast(erro.message, 'erro');
      }
    });
  }

  raiz.querySelector('#novo')?.addEventListener('click', () => formulario({}));
  raiz.querySelector('#editar')?.addEventListener('click', () => {
    if (selecionado) formulario(selecionado);
  });
  raiz.querySelector('#excluir')?.addEventListener('click', async () => {
    if (!selecionado) return;
    if (!window.confirm(`Excluir o CEST ${selecionado.cest}?`)) return;
    try {
      await excluir('cest', selecionado.id);
      ui.toast('CEST excluído.');
      selecionado = null;
      ctx.recarregar();
    } catch (erro) {
      ui.toast(erro.message, 'erro');
    }
  });
  raiz.querySelector('#cancelar-selecao').addEventListener('click', () => {
    selecionado = null;
    atualizarBarra();
    for (const tr of lista.querySelectorAll('tbody tr')) tr.classList.remove('sel');
    for (const r of lista.querySelectorAll('input[data-sel]')) r.checked = false;
  });

  raiz.querySelector('#buscar').addEventListener('click', () => {
    termo = campoBusca.value.trim();
    pagina = 0;
    consultar();
  });
  campoBusca.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      termo = campoBusca.value.trim();
      pagina = 0;
      consultar();
    }
  });
  raiz.querySelector('#anterior').addEventListener('click', () => {
    if (pagina > 0) { pagina -= 1; consultar(); }
  });
  raiz.querySelector('#proxima').addEventListener('click', () => {
    if ((pagina + 1) * POR_PAGINA < total) { pagina += 1; consultar(); }
  });

  await consultar();
}
