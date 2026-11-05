import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AiService } from '../ai.service';
import { AiError } from '../ai.types';
import { AssistantService } from './assistant.service';
import { AssistantToolbox } from './assistant-tools';
import { AssistantTool } from './assistant.types';

const tool = (name: string, run: AssistantTool['run'], allowed = true): AssistantTool => ({
  def: { name, description: name, parameters: { type: 'object', properties: {} } },
  allowed: () => allowed,
  run,
});

describe('AssistantService', () => {
  let chat: ReturnType<typeof vi.fn>;
  let getUsage: ReturnType<typeof vi.fn>;
  let tools: AssistantTool[];
  let svc: AssistantService;

  beforeEach(() => {
    chat = vi.fn();
    getUsage = vi.fn(async () => ({ today: { requests: 3, tokens: 1200 } }));
    tools = [];
    TestBed.configureTestingModule({
      providers: [
        AssistantService,
        { provide: AiService, useValue: { chat, getUsage } },
        { provide: AssistantToolbox, useValue: { available: () => tools.filter(t => t.allowed()) } },
      ],
    });
    svc = TestBed.inject(AssistantService);
  });

  it('runs the requested tool, feeds the result back and shows the final answer with the page links', async () => {
    const run = vi.fn(async () => ({ result: { invoices: [{ id: 'i1' }] }, links: [{ label: 'INV-1', url: '/account/invoices/view/i1' }] }));
    tools = [tool('find_invoices', run)];
    chat
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'c1', name: 'find_invoices', arguments: '{"search":"1"}' }] })
      .mockResolvedValueOnce({ content: 'Found INV-1.', toolCalls: [] });

    await svc.send('find invoice 1');

    expect(run).toHaveBeenCalledWith({ search: '1' });
    const second = chat.mock.calls[1][0];
    expect(second.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1', content: '{"invoices":[{"id":"i1"}]}' });
    const last = svc.items().at(-1)!;
    expect(last).toMatchObject({ role: 'assistant', text: 'Found INV-1.', links: [{ label: 'INV-1', url: '/account/invoices/view/i1' }] });
    expect(svc.busy()).toBe(false);
  });

  it("shows today's recorded usage when the panel opens and again after each answer", async () => {
    svc.toggle();
    await vi.waitFor(() => expect(svc.usageToday()).toEqual({ requests: 3, tokens: 1200 }));
    getUsage.mockResolvedValueOnce({ today: { requests: 4, tokens: 1500 } });
    chat.mockResolvedValueOnce({ content: 'hi', toolCalls: [] });
    await svc.send('hello');
    await vi.waitFor(() => expect(svc.usageToday()).toEqual({ requests: 4, tokens: 1500 }));
  });

  it('hides the usage line when the usage cannot be loaded, without breaking the chat', async () => {
    getUsage.mockRejectedValue(new Error('down'));
    chat.mockResolvedValueOnce({ content: 'still works', toolCalls: [] });
    await svc.send('hello');
    expect(svc.items().at(-1)!.text).toBe('still works');
    await vi.waitFor(() => expect(svc.usageToday()).toBeNull());
  });

  it('only offers the tools the employee may use', async () => {
    tools = [tool('find_invoices', vi.fn() as any), tool('open_new_invoice', vi.fn() as any, false)];
    chat.mockResolvedValueOnce({ content: 'ok', toolCalls: [] });
    await svc.send('hi');
    expect(chat.mock.calls[0][1].map((d: any) => d.name)).toEqual(['find_invoices']);
  });

  it('does not run a tool the model invents or one it was not offered', async () => {
    const run = vi.fn(async () => ({ result: {} }));
    tools = [tool('open_new_invoice', run, false)];
    chat
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'c1', name: 'open_new_invoice', arguments: '{}' }] })
      .mockResolvedValueOnce({ content: 'cannot', toolCalls: [] });
    await svc.send('new invoice');
    expect(run).not.toHaveBeenCalled();
    expect(chat.mock.calls[1][0].at(-1)).toMatchObject({ role: 'tool', content: '{"error":"Unknown tool"}' });
  });

  it('turns a failing tool into an error result for the model instead of breaking the chat', async () => {
    tools = [tool('find_invoices', async () => { throw new Error('boom'); })];
    chat
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'c1', name: 'find_invoices', arguments: '{}' }] })
      .mockResolvedValueOnce({ content: 'sorry', toolCalls: [] });
    await svc.send('find');
    expect(chat.mock.calls[1][0].at(-1).content).toContain('boom');
    expect(svc.items().at(-1)!.text).toBe('sorry');
  });

  it('stops a model that keeps calling tools after the step limit', async () => {
    tools = [tool('find_invoices', async () => ({ result: {} }))];
    chat.mockResolvedValue({ content: '', toolCalls: [{ id: 'c', name: 'find_invoices', arguments: '{}' }] });
    await svc.send('loop');
    expect(chat).toHaveBeenCalledTimes(6);
    expect(svc.items().at(-1)).toMatchObject({ error: true, key: 'ASSISTANT.ERR_TOO_MANY_STEPS' });
    expect(svc.busy()).toBe(false);
  });

  it('maps provider errors to a readable message', async () => {
    chat.mockRejectedValueOnce(new AiError('AI_NOT_CONFIGURED'));
    await svc.send('hi');
    expect(svc.items().at(-1)).toMatchObject({ error: true, key: 'ASSISTANT.ERR_NOT_CONFIGURED' });
  });

  it('ignores a second question while one is running and tolerates malformed tool arguments', async () => {
    const run = vi.fn(async () => ({ result: {} }));
    tools = [tool('find_invoices', run)];
    chat
      .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'c1', name: 'find_invoices', arguments: 'not json' }] })
      .mockResolvedValueOnce({ content: 'done', toolCalls: [] });
    const first = svc.send('one');
    await svc.send('two');            // busy: dropped
    await first;
    expect(run).toHaveBeenCalledWith({});
    expect(svc.items().filter(i => i.role === 'user').map(i => i.text)).toEqual(['one']);
  });
});
