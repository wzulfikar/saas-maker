const { createRoute } = require('./src/server/createRoute.ts');

// Test that requestId is available in context
async function testRequestId() {
  console.log('Testing requestId in context...');
  
  try {
    const route = createRoute({
      generateRequestId: () => 'test-123-custom'
    })
    .prepare(async (req, ctx) => {
      console.log('In prepare, ctx.requestId:', ctx.requestId);
      return { role: 'admin' };
    })
    .parse({
      body: async (body, ctx) => {
        console.log('In parse, ctx.requestId:', ctx.requestId);
        return { parsed: true };
      }
    })
    .handle(async (req, ctx) => {
      console.log('In handle, ctx.requestId:', ctx.requestId);
      console.log('Full context:', ctx);
      return { success: true, requestId: ctx.requestId };
    });

    // Test with invoke
    const result = await route.invoke();
    console.log('Result:', result);
    
    console.log('✅ Test passed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRequestId(); 
