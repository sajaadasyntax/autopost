import { readCanvaJob } from './canva-job';

describe('readCanvaJob', () => {
  it('reads an autofill design id', () => {
    expect(
      readCanvaJob({
        job: {
          status: 'success',
          result: { type: 'create_design', design: { id: 'DAFdesign' } },
        },
      }),
    ).toEqual({ state: 'success', designId: 'DAFdesign', downloadUrl: undefined });
  });

  it('reads an export download url and a failure', () => {
    expect(
      readCanvaJob({
        job: { status: 'success', urls: ['https://export.canva.com/file.jpg'] },
      }).downloadUrl,
    ).toBe('https://export.canva.com/file.jpg');
    expect(readCanvaJob({ job: { status: 'failed', error: 'bad template' } }).state).toBe('failed');
    expect(readCanvaJob({ job: { status: 'in_progress' } }).state).toBe('pending');
  });
});
